"use client";

import { GridStack } from "gridstack";
import { GripVertical } from "lucide-react";
import { Children, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  DASHBOARD_COLUMN_COUNT,
  layoutFingerprint,
  normalizeGridLayout,
  type DashboardLayoutWidget,
} from "@/lib/dashboard/layout";

type DashboardGridWidget = {
  id: string;
  title: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type GridStackDashboardProps = {
  dashboardId: string;
  widgets: DashboardGridWidget[];
  children: ReactNode;
};

export function GridStackDashboard({
  dashboardId,
  widgets,
  children,
}: GridStackDashboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);
  const finalSaveFrameRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const queuedLayoutRef = useRef<DashboardLayoutWidget[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const initialLayout = useMemo(
    () =>
      widgets.map((widget) => ({
        id: widget.id,
        x: widget.positionX,
        y: widget.positionY,
        width: widget.width,
        height: widget.height,
      })),
    [widgets],
  );
  const lastSavedFingerprintRef = useRef(layoutFingerprint(initialLayout));
  const childNodes = Children.toArray(children);

  useEffect(() => {
    lastSavedFingerprintRef.current = layoutFingerprint(initialLayout);
  }, [initialLayout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const persistLayout = async (layout: DashboardLayoutWidget[]): Promise<void> => {
      const fingerprint = layoutFingerprint(layout);
      if (fingerprint === lastSavedFingerprintRef.current) {
        return;
      }

      if (savingRef.current) {
        queuedLayoutRef.current = layout;
        return;
      }

      savingRef.current = true;
      setSaveStatus("saving");

      try {
        const response = await fetch("/api/dashboard/layout", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          keepalive: true,
          body: JSON.stringify({ dashboardId, widgets: layout }),
        });

        if (!response.ok) {
          throw new Error(`Layout save failed with ${response.status}`);
        }

        lastSavedFingerprintRef.current = fingerprint;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      } finally {
        savingRef.current = false;
        const queued = queuedLayoutRef.current;
        queuedLayoutRef.current = null;
        if (queued && layoutFingerprint(queued) !== lastSavedFingerprintRef.current) {
          void persistLayout(queued);
        }
      }
    };

    const readCurrentLayout = (grid: GridStack): DashboardLayoutWidget[] | null => {
      if (grid.getColumn() !== DASHBOARD_COLUMN_COUNT) {
        return null;
      }

      const layout = normalizeGridLayout(
        grid.getGridItems().map((element) => {
          const node = element.gridstackNode;
          return {
            id: node?.id,
            x: node?.x,
            y: node?.y,
            w: node?.w,
            h: node?.h,
          };
        }),
      );

      return layout.length === widgets.length ? layout : null;
    };

    const persistSettledLayout = (grid: GridStack) => {
      if (finalSaveFrameRef.current !== null) {
        window.cancelAnimationFrame(finalSaveFrameRef.current);
      }

      finalSaveFrameRef.current = window.requestAnimationFrame(() => {
        finalSaveFrameRef.current = null;
        const layout = readCurrentLayout(grid);
        if (layout) {
          void persistLayout(layout);
        }
      });
    };

    const grid = GridStack.init(
      {
        column: DASHBOARD_COLUMN_COUNT,
        cellHeight: 150,
        margin: 8,
        animate: true,
        float: false,
        handle: ".grid-stack-handle",
        resizable: { handles: "se" },
        columnOpts: {
          breakpoints: [
            { w: 720, c: 1, layout: "list" },
            { w: 1180, c: 3, layout: "moveScale" },
          ],
          layout: "moveScale",
        },
      },
      container,
    );

    if (!grid) {
      setSaveStatus("error");
      return;
    }

    gridRef.current = grid;
    grid.on("dragstart", () => setSaveStatus("idle"));
    grid.on("resizestart", () => setSaveStatus("idle"));
    grid.on("dragstop", () => persistSettledLayout(grid));
    grid.on("resizestop", () => persistSettledLayout(grid));

    return () => {
      if (finalSaveFrameRef.current !== null) {
        window.cancelAnimationFrame(finalSaveFrameRef.current);
        finalSaveFrameRef.current = null;
      }
      grid.destroy(false);
      gridRef.current = null;
    };
  }, [dashboardId, widgets]);

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 justify-end" aria-live="polite">
        {saveStatus === "saving" ? (
          <span className="text-muted-foreground text-xs">Enregistrement…</span>
        ) : null}
        {saveStatus === "saved" ? (
          <span className="text-success text-xs">Disposition enregistrée</span>
        ) : null}
        {saveStatus === "error" ? (
          <span className="text-destructive text-xs">
            Impossible d’enregistrer la disposition. Tes changements restent affichés.
          </span>
        ) : null}
      </div>

      <div ref={containerRef} className="grid-stack">
        {widgets.map((widget, index) => (
          <div
            key={widget.id}
            className="grid-stack-item"
            gs-id={widget.id}
            gs-x={widget.positionX}
            gs-y={widget.positionY}
            gs-w={widget.width}
            gs-h={widget.height}
            gs-min-w={widget.minWidth}
            gs-min-h={widget.minHeight}
          >
            <div className="grid-stack-item-content relative overflow-visible">
              <button
                type="button"
                className="grid-stack-handle border-border/70 bg-surface-elevated/90 text-muted-foreground hover:text-foreground focus-visible:ring-primary absolute top-2 right-2 z-20 flex size-8 cursor-grab items-center justify-center rounded-lg border shadow-sm transition focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
                aria-label={`Déplacer le widget ${widget.title}`}
                title={`Déplacer ${widget.title}`}
              >
                <GripVertical className="size-4" aria-hidden="true" />
              </button>
              <div className="h-full">{childNodes[index] ?? null}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
