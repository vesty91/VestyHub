"use client";

import { GridStack } from "gridstack";
import { GripVertical } from "lucide-react";
import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  LayoutControls,
  type LayoutSaveStatus,
} from "@/components/layout/layout-controls";
import {
  FAVORITES_COLUMN_COUNT,
  buildDefaultFavoriteLayout,
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
  const gridRef = useRef<GridStack | null>(null);
  const finalSaveFrameRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const editingRef = useRef(false);
  const queuedLayoutRef = useRef<FavoriteLayoutItem[] | null>(null);
  const failedLayoutRef = useRef<FavoriteLayoutItem[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<LayoutSaveStatus>("idle");
  const [isEditing, setIsEditing] = useState(false);

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
  const defaultLayout = useMemo(
    () => buildDefaultFavoriteLayout(items.map((item) => item.id)),
    [items],
  );
  const lastSavedFingerprintRef = useRef(favoriteLayoutFingerprint(initialLayout));
  const childNodes = Children.toArray(children);

  useEffect(() => {
    lastSavedFingerprintRef.current = favoriteLayoutFingerprint(initialLayout);
  }, [initialLayout]);

  const persistLayout = useCallback(
    async function persistLayout(layout: FavoriteLayoutItem[]): Promise<void> {
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
      failedLayoutRef.current = null;
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
        failedLayoutRef.current = layout;
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
    },
    [canEdit],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

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
      if (!canEdit || !editingRef.current) {
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
        disableDrag: true,
        disableResize: true,
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

    gridRef.current = grid;
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
      gridRef.current = null;
    };
  }, [canEdit, items, persistLayout]);

  useEffect(() => {
    const editable = canEdit && isEditing;
    editingRef.current = editable;
    gridRef.current?.enableMove(editable);
    gridRef.current?.enableResize(editable);
  }, [canEdit, isEditing]);

  const applyLayout = useCallback((layout: FavoriteLayoutItem[]) => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const elementsById = new Map<string, HTMLElement>();
    for (const element of grid.getGridItems()) {
      const id = element.gridstackNode?.id;
      if (id) {
        elementsById.set(id, element);
      }
    }

    grid.batchUpdate();
    for (const item of layout) {
      const element = elementsById.get(item.id);
      if (element) {
        grid.update(element, {
          x: item.x,
          y: item.y,
          w: item.width,
          h: item.height,
        });
      }
    }
    grid.batchUpdate(false);
  }, []);

  const handleReset = () => {
    const grid = gridRef.current;
    if (!grid || !canEdit) {
      return;
    }

    if (grid.getColumn() !== FAVORITES_COLUMN_COUNT) {
      window.alert(
        "Repasse en vue ordinateur pour réinitialiser la disposition desktop.",
      );
      return;
    }

    if (!window.confirm("Réinitialiser la disposition des favoris par défaut ?")) {
      return;
    }

    applyLayout(defaultLayout);
    void persistLayout(defaultLayout);
  };

  const handleRetry = () => {
    const failedLayout = failedLayoutRef.current;
    if (failedLayout) {
      void persistLayout(failedLayout);
    }
  };

  return (
    <div className="space-y-2">
      {canEdit ? (
        <LayoutControls
          isEditing={isEditing}
          saveStatus={saveStatus}
          onToggleEditing={() => setIsEditing((value) => !value)}
          onReset={handleReset}
          onRetry={handleRetry}
        />
      ) : null}

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
              {canEdit && isEditing ? (
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
