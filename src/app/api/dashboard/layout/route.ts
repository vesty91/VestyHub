import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { dashboardWidgets, dashboards } from "@/db/schema";
import { canMutateDashboard } from "@/lib/auth/roles";
import { getCurrentSession } from "@/lib/auth/session";
import { dashboardLayoutPayloadSchema } from "@/lib/dashboard/layout";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }
  if (!canMutateDashboard(session.user.role)) {
    return NextResponse.json(
      { error: "Droits d’édition requis." },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps JSON invalide." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = dashboardLayoutPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Disposition invalide.", issues: parsed.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { dashboardId, widgets } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      const [ownedDashboard] = await tx
        .select({ id: dashboards.id })
        .from(dashboards)
        .where(
          and(eq(dashboards.id, dashboardId), eq(dashboards.userId, session.user.id)),
        )
        .limit(1);

      if (!ownedDashboard) {
        throw new LayoutAccessError();
      }

      if (widgets.length === 0) {
        return;
      }

      const widgetIds = widgets.map((widget) => widget.id);
      const storedWidgets = await tx
        .select({
          id: dashboardWidgets.id,
          minWidth: dashboardWidgets.minWidth,
          minHeight: dashboardWidgets.minHeight,
        })
        .from(dashboardWidgets)
        .where(
          and(
            eq(dashboardWidgets.dashboardId, dashboardId),
            inArray(dashboardWidgets.id, widgetIds),
          ),
        );

      if (storedWidgets.length !== widgets.length) {
        throw new LayoutAccessError();
      }

      const constraints = new Map(storedWidgets.map((widget) => [widget.id, widget]));
      for (const widget of widgets) {
        const stored = constraints.get(widget.id);
        if (
          !stored ||
          widget.width < stored.minWidth ||
          widget.height < stored.minHeight
        ) {
          throw new LayoutValidationError();
        }
      }

      const updatedAt = new Date();
      for (const widget of widgets) {
        await tx
          .update(dashboardWidgets)
          .set({
            positionX: widget.x,
            positionY: widget.y,
            width: widget.width,
            height: widget.height,
            updatedAt,
          })
          .where(
            and(
              eq(dashboardWidgets.id, widget.id),
              eq(dashboardWidgets.dashboardId, dashboardId),
            ),
          );
      }

      await tx
        .update(dashboards)
        .set({ updatedAt })
        .where(eq(dashboards.id, dashboardId));
    });
  } catch (error) {
    if (error instanceof LayoutAccessError) {
      return NextResponse.json(
        { error: "Dashboard introuvable." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof LayoutValidationError) {
      return NextResponse.json(
        {
          error: "La disposition ne respecte pas les dimensions minimales des widgets.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }

  return NextResponse.json(
    { version: 1, saved: widgets.length },
    { headers: NO_STORE_HEADERS },
  );
}

class LayoutAccessError extends Error {}
class LayoutValidationError extends Error {}
