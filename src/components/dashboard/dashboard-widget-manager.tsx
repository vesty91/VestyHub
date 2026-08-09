"use client";

import { Eye, EyeOff, Plus, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DASHBOARD_WIDGET_CATALOG,
  type DashboardWidgetType,
} from "@/lib/dashboard/widget-catalog";

type DashboardWidgetState = {
  type: string;
  isVisible: boolean;
};

type DashboardWidgetManagerProps = {
  dashboardId: string;
  widgets: DashboardWidgetState[];
};

export function DashboardWidgetManager({
  dashboardId,
  widgets,
}: DashboardWidgetManagerProps) {
  const router = useRouter();
  const [pendingType, setPendingType] = useState<DashboardWidgetType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const widgetStateByType = useMemo(
    () => new Map(widgets.map((widget) => [widget.type, widget.isVisible])),
    [widgets],
  );

  async function changeWidget(type: DashboardWidgetType) {
    const isVisible = widgetStateByType.get(type) === true;

    setPendingType(type);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/widgets", {
        method: isVisible ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(
          isVisible
            ? { dashboardId, type, isVisible: false }
            : { dashboardId, type },
        ),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Mutation refusée (${response.status}).`);
      }

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible de modifier ce widget.",
      );
    } finally {
      setPendingType(null);
    }
  }

  return (
    <div className="border-border/70 bg-surface-elevated/45 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="text-primary size-4" aria-hidden="true" />
            Gérer les widgets
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Affiche, masque ou réactive les widgets du catalogue VestyHub.
          </p>
        </div>
        <span className="text-muted-foreground text-xs">
          {DASHBOARD_WIDGET_CATALOG.filter(
            (widget) => widgetStateByType.get(widget.type) === true,
          ).length}
          /{DASHBOARD_WIDGET_CATALOG.length} affichés
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {DASHBOARD_WIDGET_CATALOG.map((widget) => {
          const storedVisibility = widgetStateByType.get(widget.type);
          const isStored = storedVisibility !== undefined;
          const isVisible = storedVisibility === true;
          const isPending = pendingType === widget.type;
          const statusLabel = isVisible ? "Affiché" : isStored ? "Masqué" : "Disponible";
          const actionLabel = isPending
            ? "Mise à jour…"
            : isVisible
              ? "Masquer"
              : isStored
                ? "Afficher"
                : "Ajouter";
          const ActionIcon = isVisible ? EyeOff : isStored ? Eye : Plus;

          return (
            <div
              key={widget.type}
              className="border-border/60 bg-background/35 flex min-h-32 flex-col rounded-xl border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{widget.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {widget.description}
                  </p>
                </div>
                <span
                  className={
                    isVisible
                      ? "bg-success/10 text-success rounded-full px-2 py-1 text-[10px] font-medium"
                      : "bg-muted text-muted-foreground rounded-full px-2 py-1 text-[10px] font-medium"
                  }
                >
                  {statusLabel}
                </span>
              </div>

              <Button
                type="button"
                variant={isVisible ? "outline" : "default"}
                size="sm"
                className="mt-auto self-start"
                disabled={pendingType !== null}
                onClick={() => void changeWidget(widget.type)}
              >
                <ActionIcon aria-hidden="true" />
                {actionLabel}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 min-h-4 text-xs" aria-live="polite">
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}
