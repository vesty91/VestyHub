import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { dashboardWidgets, dashboards } from "@/db/schema";
import { canMutateDashboard } from "@/lib/auth/roles";
import { getCurrentSession } from "@/lib/auth/session";
import { dashboardWidgetSettingsPayloadSchema } from "@/lib/dashboard/widget-catalog";

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

  const parsed = dashboardWidgetSettingsPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres de widget invalides.", issues: parsed.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { dashboardId, type, configuration } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [ownedDashboard] = await tx
        .select({ id: dashboards.id })
        .from(dashboards)
        .where(
          and(eq(dashboards.id, dashboardId), eq(dashboards.userId, session.user.id)),
        )
        .limit(1);

      if (!ownedDashboard) {
        throw new WidgetSettingsAccessError();
      }

      const [storedWidget] = await tx
        .select({ id: dashboardWidgets.id })
        .from(dashboardWidgets)
        .where(
          and(
            eq(dashboardWidgets.dashboardId, dashboardId),
            eq(dashboardWidgets.widgetType, type),
          ),
        )
        .limit(1);

      if (!storedWidget) {
        throw new WidgetSettingsAccessError();
      }

      const updatedAt = new Date();
      await tx
        .update(dashboardWidgets)
        .set({ configuration, updatedAt })
        .where(eq(dashboardWidgets.id, storedWidget.id));

      await tx
        .update(dashboards)
        .set({ updatedAt })
        .where(eq(dashboards.id, dashboardId));

      return {
        widget: {
          id: storedWidget.id,
          type,
          configuration,
        },
      };
    });

    return NextResponse.json({ version: 1, ...result }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof WidgetSettingsAccessError) {
      return NextResponse.json(
        { error: "Widget introuvable." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }
}

class WidgetSettingsAccessError extends Error {}
