import { z } from "zod";

export const DASHBOARD_COLUMN_COUNT = 6;
export const DASHBOARD_MAX_WIDGETS = 48;
export const DASHBOARD_MAX_ROWS = 200;
export const DASHBOARD_MAX_WIDGET_HEIGHT = 12;

export const dashboardLayoutWidgetSchema = z
  .object({
    id: z.string().uuid(),
    x: z
      .number()
      .int()
      .min(0)
      .max(DASHBOARD_COLUMN_COUNT - 1),
    y: z.number().int().min(0).max(DASHBOARD_MAX_ROWS),
    width: z.number().int().min(1).max(DASHBOARD_COLUMN_COUNT),
    height: z.number().int().min(1).max(DASHBOARD_MAX_WIDGET_HEIGHT),
  })
  .superRefine((widget, context) => {
    if (widget.x + widget.width > DASHBOARD_COLUMN_COUNT) {
      context.addIssue({
        code: "custom",
        path: ["width"],
        message: `Le widget doit rester dans les ${DASHBOARD_COLUMN_COUNT} colonnes du dashboard.`,
      });
    }
  });

export const dashboardLayoutPayloadSchema = z
  .object({
    dashboardId: z.string().uuid(),
    widgets: z.array(dashboardLayoutWidgetSchema).max(DASHBOARD_MAX_WIDGETS),
  })
  .superRefine((payload, context) => {
    const seen = new Set<string>();

    payload.widgets.forEach((widget, index) => {
      if (seen.has(widget.id)) {
        context.addIssue({
          code: "custom",
          path: ["widgets", index, "id"],
          message: "Un widget ne peut apparaître qu'une fois dans la disposition.",
        });
      }
      seen.add(widget.id);
    });
  });

export type DashboardLayoutWidget = z.infer<typeof dashboardLayoutWidgetSchema>;
export type DashboardLayoutPayload = z.infer<typeof dashboardLayoutPayloadSchema>;

export type GridLayoutInput = {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export type DashboardDefaultLayoutInput = {
  id: string;
  widgetType: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
};

type DashboardWidgetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DASHBOARD_DEFAULT_WIDGET_LAYOUTS: Record<
  string,
  Omit<DashboardLayoutWidget, "id">
> = {
  clock: { x: 0, y: 0, width: 2, height: 1 },
  favorites: { x: 2, y: 0, width: 4, height: 2 },
  "system-status": { x: 0, y: 1, width: 2, height: 2 },
};

function toBoundedInteger(
  value: number | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function rectanglesOverlap(
  left: DashboardWidgetRect,
  right: DashboardWidgetRect,
): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

function findFirstAvailableDashboardPosition(
  items: readonly DashboardWidgetRect[],
  width: number,
  height: number,
): { x: number; y: number } | null {
  for (let y = 0; y <= DASHBOARD_MAX_ROWS; y += 1) {
    for (let x = 0; x <= DASHBOARD_COLUMN_COUNT - width; x += 1) {
      const candidate = { x, y, width, height };
      if (!items.some((item) => rectanglesOverlap(candidate, item))) {
        return { x, y };
      }
    }
  }

  return null;
}

export function normalizeGridLayout(
  items: readonly GridLayoutInput[],
): DashboardLayoutWidget[] {
  const normalized: DashboardLayoutWidget[] = [];

  for (const item of items) {
    if (!item.id) {
      continue;
    }

    const x = toBoundedInteger(item.x, 0, DASHBOARD_COLUMN_COUNT - 1);
    const y = toBoundedInteger(item.y, 0, DASHBOARD_MAX_ROWS);
    const requestedWidth = toBoundedInteger(item.w, 1, DASHBOARD_COLUMN_COUNT);
    const height = toBoundedInteger(item.h, 1, DASHBOARD_MAX_WIDGET_HEIGHT);

    if (x === null || y === null || requestedWidth === null || height === null) {
      continue;
    }

    normalized.push({
      id: item.id,
      x,
      y,
      width: Math.min(requestedWidth, DASHBOARD_COLUMN_COUNT - x),
      height,
    });
  }

  return normalized;
}

export function buildDefaultDashboardLayout(
  widgets: readonly DashboardDefaultLayoutInput[],
): DashboardLayoutWidget[] {
  const layout: DashboardLayoutWidget[] = [];
  const occupied: DashboardWidgetRect[] = [];

  for (const widget of widgets) {
    const preset = DASHBOARD_DEFAULT_WIDGET_LAYOUTS[widget.widgetType];
    const width = Math.min(
      DASHBOARD_COLUMN_COUNT,
      Math.max(widget.minWidth, preset?.width ?? widget.width),
    );
    const height = Math.min(
      DASHBOARD_MAX_WIDGET_HEIGHT,
      Math.max(widget.minHeight, preset?.height ?? widget.height),
    );

    let position = preset
      ? {
          x: Math.min(preset.x, DASHBOARD_COLUMN_COUNT - width),
          y: preset.y,
        }
      : null;

    if (position) {
      const candidate: DashboardWidgetRect = {
        x: position.x,
        y: position.y,
        width,
        height,
      };

      if (occupied.some((item) => rectanglesOverlap(candidate, item))) {
        position = null;
      }
    }

    position ??= findFirstAvailableDashboardPosition(occupied, width, height);
    if (!position) {
      continue;
    }

    const item = {
      id: widget.id,
      x: position.x,
      y: position.y,
      width,
      height,
    };
    layout.push(item);
    occupied.push(item);
  }

  return layout;
}

export function layoutFingerprint(items: readonly DashboardLayoutWidget[]): string {
  return JSON.stringify(
    [...items]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
  );
}
