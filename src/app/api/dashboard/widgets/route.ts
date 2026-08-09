import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { dashboardWidgets, dashboards } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { findDashboardWidgetPlacement } from "@/lib/dashboard/layout";
import {
  dashboardWidgetSelectionPayloadSchema,
  dashboardWidgetVisibilityPayloadSchema,
  getDashboardWidgetDefinition,
} from "@/lib/dashboard/widget-catalog";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: NO_STORE_HEADERS },
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

  const parsed = dashboardWidgetSelectionPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Widget invalide.", issues: parsed.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { dashboardId, type } = parsed.data;
  const definition = getDashboardWidgetDefinition(type);

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
        throw new WidgetAccessError();
      }

      const [existingWidget] = await tx
        .select({
          id: dashboardWidgets.id,
          isVisible: dashboardWidgets.isVisible,
        })
        .from(dashboardWidgets)
        .where(
          and(
            eq(dashboardWidgets.dashboardId, dashboardId),
            eq(dashboardWidgets.widgetType, type),
          ),
        )
        .limit(1);

      if (existingWidget) {
        const reactivated = !existingWidget.isVisible;
        if (reactivated) {
          const updatedAt = new Date();
          await tx
            .update(dashboardWidgets)
            .set({ isVisible: true, updatedAt })
            .where(eq(dashboardWidgets.id, existingWidget.id));
          await tx
            .update(dashboards)
            .set({ updatedAt })
            .where(eq(dashboards.id, dashboardId));
        }

        return {
          created: false,
          reactivated,
          widget: { id: existingWidget.id, type, isVisible: true },
        };
      }

      const occupiedWidgets = await tx
        .select({
          x: dashboardWidgets.positionX,
          y: dashboardWidgets.positionY,
          width: dashboardWidgets.width,
          height: dashboardWidgets.height,
        })
        .from(dashboardWidgets)
        .where(
          and(
            eq(dashboardWidgets.dashboardId, dashboardId),
            eq(dashboardWidgets.isVisible, true),
          ),
        );

      const placement = findDashboardWidgetPlacement(
        occupiedWidgets,
        definition.width,
        definition.height,
      );
      if (!placement) {
        throw new WidgetPlacementError();
      }

      const updatedAt = new Date();
      const [createdWidget] = await tx
        .insert(dashboardWidgets)
        .values({
          dashboardId,
          widgetType: definition.type,
          title: definition.title,
          configuration: {},
          positionX: placement.x,
          positionY: placement.y,
          width: definition.width,
          height: definition.height,
          minWidth: definition.minWidth,
          minHeight: definition.minHeight,
          refreshInterval: definition.refreshInterval,
          isVisible: true,
          updatedAt,
        })
        .returning({ id: dashboardWidgets.id });

      if (!createdWidget) {
        throw new Error("Impossible de créer le widget dashboard.");
      }

      await tx
        .update(dashboards)
        .set({ updatedAt })
        .where(eq(dashboards.id, dashboardId));

      return {
        created: true,
        reactivated: false,
        widget: { id: createdWidget.id, type, isVisible: true },
      };
    });

    return NextResponse.json(
      { version: 1, ...result },
      { status: result.created ? 201 : 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof WidgetAccessError) {
      return NextResponse.json(
        { error: "Dashboard introuvable." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof WidgetPlacementError) {
      return NextResponse.json(
        { error: "Aucun emplacement disponible pour ce widget." },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401, headers: NO_STORE_HEADERS },
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

  const parsed = dashboardWidgetVisibilityPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Visibilité invalide.", issues: parsed.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const { dashboardId, type, isVisible } = parsed.data;

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
        throw new WidgetAccessError();
      }

      const [storedWidget] = await tx
        .select({
          id: dashboardWidgets.id,
          isVisible: dashboardWidgets.isVisible,
        })
        .from(dashboardWidgets)
        .where(
          and(
            eq(dashboardWidgets.dashboardId, dashboardId),
            eq(dashboardWidgets.widgetType, type),
          ),
        )
        .limit(1);

      if (!storedWidget) {
        throw new WidgetAccessError();
      }

      const changed = storedWidget.isVisible !== isVisible;
      if (changed) {
        const updatedAt = new Date();
        await tx
          .update(dashboardWidgets)
          .set({ isVisible, updatedAt })
          .where(eq(dashboardWidgets.id, storedWidget.id));
        await tx
          .update(dashboards)
          .set({ updatedAt })
          .where(eq(dashboards.id, dashboardId));
      }

      return {
        changed,
        widget: { id: storedWidget.id, type, isVisible },
      };
    });

    return NextResponse.json(
      { version: 1, ...result },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof WidgetAccessError) {
      return NextResponse.json(
        { error: "Widget introuvable." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    throw error;
  }
}

class WidgetAccessError extends Error {}
class WidgetPlacementError extends Error {}
