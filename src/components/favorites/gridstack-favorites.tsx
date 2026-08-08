"use client";

import { GridStack } from "gridstack";
import { GripVertical } from "lucide-react";
import { Children, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  FAVORITES_COLUMN_COUNT,
  favoriteLayoutFingerprint,
  normalizeFavoriteGridLayout,
  type FavoriteLayoutItem,
} from "@/lib/favorites/layout";

type FavoriteGridItem = {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function GridStackFavorites({
  items,
  canEdit,
  children,
}: {
  items: FavoriteGridItem[];
  canEdit: boolean;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const finalSaveFrameRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const queuedLayoutRef = useRef<FavoriteLayoutItem[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const initialLayout = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        x: item.positionX,
        y: item.positionY,
        width: item.width,
        height: item.height,
      })),
    [items],
  );
  const lastSavedFingerprintRef = useRef(favoriteLayoutFingerprint(initialLayout));
  const childNodes = Children.toArray(children);

  useEffect(() => {
    lastSavedFingerprintRef.current = favoriteLayoutFingerprint(initialLayout);
  }, [initialLayout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const persistLayout = async (layout: FavoriteLayoutItem[]): Promise<void> => {
      if (!canEdit) {
        return;
      }

      const fingerprint = favoriteLayoutFingerprint(layout);
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
        const response = await fetch("/api/favorites/layout", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          keepalive: true,
          body: JSON.stringify({ items: layout }),
        });

        if (!response.ok) {
          throw new Error(`Favorite layout save failed with ${response.status}`);
        }

        lastSavedFingerprintRef.current = fingerprint;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      } finally {
        savingRef.current = false;
        const queued = queuedLayoutRef.current;
        queuedLayoutRef.current = null;
        if (
          queued &&
          favoriteLayoutFingerprint(queued) !== lastSavedFingerprintRef.current
        ) {
          void persistLayout(queued);
        }
      }
    };

    const readCurrentLayout = (grid: GridStack): FavoriteLayoutItem[] | null => {
      if (grid.getColumn() !== FAVORITES_COLUMN_COUNT) {
        return null;
      }

      const layout = normalizeFavoriteGridLayout(
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

      return layout.length === items.length ? layout : null;
    };

    const persistSettledLayout = (grid: GridStack) => {
      if (!canEdit) {
        return;
      }

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
        column: FAVORITES_COLUMN_COUNT,
        cellHeight: 92,
        margin: 8,
        animate: true,
        float: true,
        disableDrag: !canEdit,
        disableResize: !canEdit,
        handle: ".favorites-grid-handle",
        resizable: { handles: "se" },
        columnOpts: {
          breakpoints: [
            { w: 720, c: 1, layout: "list" },
            { w: 1180, c: 6, layout: "moveScale" },
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

    if (canEdit) {
      grid.on("dragstart", () => setSaveStatus("idle"));
      grid.on("resizestart", () => setSaveStatus("idle"));
      grid.on("dragstop", () => persistSettledLayout(grid));
      grid.on("resizestop", () => persistSettledLayout(grid));
    }

    return () => {
      if (finalSaveFrameRef.current !== null) {
        window.cancelAnimationFrame(finalSaveFrameRef.current);
        finalSaveFrameRef.current = null;
      }
      grid.destroy(false);
    };
  }, [canEdit, items]);

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
            Impossible d’enregistrer la disposition. Les changements restent affichés.
          </span>
        ) : null}
      </div>

      <div ref={containerRef} className="grid-stack">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid-stack-item"
            gs-id={item.id}
            gs-x={item.positionX}
            gs-y={item.positionY}
            gs-w={item.width}
            gs-h={item.height}
            gs-min-w={2}
            gs-min-h={2}
          >
            <div className="grid-stack-item-content relative overflow-visible">
              {canEdit ? (
                <button
                  type="button"
                  className="favorites-grid-handle border-border/70 bg-surface-elevated/90 text-muted-foreground hover:text-foreground focus-visible:ring-primary absolute top-2 right-2 z-30 flex size-8 cursor-grab items-center justify-center rounded-lg border shadow-sm transition focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
                  aria-label={`Déplacer le favori ${item.name}`}
                  title={`Déplacer ${item.name}`}
                >
                  <GripVertical className="size-4" aria-hidden="true" />
                </button>
              ) : null}
              <div className="h-full">{childNodes[index] ?? null}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
