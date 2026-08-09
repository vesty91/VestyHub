import { describe, expect, it } from "vitest";

import {
  DASHBOARD_COLUMN_COUNT,
  DASHBOARD_MAX_WIDGETS,
  buildDefaultDashboardLayout,
  dashboardLayoutPayloadSchema,
  findDashboardWidgetPlacement,
  layoutFingerprint,
  normalizeGridLayout,
} from "./layout";

const dashboardId = "11111111-1111-4111-8111-111111111111";
const widgetId = "22222222-2222-4222-8222-222222222222";

describe("dashboard layout validation", () => {
  it("accepts a bounded dashboard layout", () => {
    const result = dashboardLayoutPayloadSchema.safeParse({
      dashboardId,
      widgets: [{ id: widgetId, x: 0, y: 2, width: 3, height: 2 }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects widgets outside the six-column dashboard", () => {
    const result = dashboardLayoutPayloadSchema.safeParse({
      dashboardId,
      widgets: [{ id: widgetId, x: 5, y: 0, width: 2, height: 1 }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid coordinates and dimensions", () => {
    const result = dashboardLayoutPayloadSchema.safeParse({
      dashboardId,
      widgets: [{ id: widgetId, x: -1, y: 0, width: 0, height: 1 }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate widget identifiers", () => {
    const result = dashboardLayoutPayloadSchema.safeParse({
      dashboardId,
      widgets: [
        { id: widgetId, x: 0, y: 0, width: 2, height: 1 },
        { id: widgetId, x: 2, y: 0, width: 2, height: 1 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("bounds the number of widgets accepted in one request", () => {
    const widgets = Array.from({ length: DASHBOARD_MAX_WIDGETS + 1 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      x: 0,
      y: index,
      width: 1,
      height: 1,
    }));

    expect(dashboardLayoutPayloadSchema.safeParse({ dashboardId, widgets }).success).toBe(
      false,
    );
  });
});

describe("dashboard default layout", () => {
  it("restores the seeded layout for the built-in widgets", () => {
    expect(
      buildDefaultDashboardLayout([
        {
          id: "clock-id",
          widgetType: "clock",
          width: 5,
          height: 4,
          minWidth: 1,
          minHeight: 1,
        },
        {
          id: "favorites-id",
          widgetType: "favorites",
          width: 2,
          height: 6,
          minWidth: 1,
          minHeight: 2,
        },
        {
          id: "status-id",
          widgetType: "system-status",
          width: 6,
          height: 5,
          minWidth: 1,
          minHeight: 2,
        },
      ]),
    ).toEqual([
      { id: "clock-id", x: 0, y: 0, width: 2, height: 1 },
      { id: "favorites-id", x: 2, y: 0, width: 4, height: 2 },
      { id: "status-id", x: 0, y: 1, width: 2, height: 2 },
    ]);
  });

  it("places unknown widgets in the first free area without collisions", () => {
    expect(
      buildDefaultDashboardLayout([
        {
          id: "clock-id",
          widgetType: "clock",
          width: 2,
          height: 1,
          minWidth: 1,
          minHeight: 1,
        },
        {
          id: "custom-id",
          widgetType: "custom",
          width: 2,
          height: 1,
          minWidth: 1,
          minHeight: 1,
        },
      ]),
    ).toEqual([
      { id: "clock-id", x: 0, y: 0, width: 2, height: 1 },
      { id: "custom-id", x: 2, y: 0, width: 2, height: 1 },
    ]);
  });

  it("finds the first free position for a newly added widget", () => {
    expect(
      findDashboardWidgetPlacement(
        [{ x: 0, y: 0, width: DASHBOARD_COLUMN_COUNT, height: 1 }],
        2,
        2,
      ),
    ).toEqual({ x: 0, y: 1 });
  });

  it("rejects invalid placement dimensions", () => {
    expect(findDashboardWidgetPlacement([], 0, 1)).toBeNull();
    expect(findDashboardWidgetPlacement([], DASHBOARD_COLUMN_COUNT + 1, 1)).toBeNull();
  });
});

describe("GridStack layout normalization", () => {
  it("normalizes finite values and keeps widgets inside the desktop grid", () => {
    expect(
      normalizeGridLayout([
        { id: widgetId, x: 5.9, y: 3.8, w: 4, h: 2.9 },
        { id: "missing-values" },
      ]),
    ).toEqual([{ id: widgetId, x: 5, y: 3, width: 1, height: 2 }]);
  });

  it("uses a stable fingerprint regardless of item ordering", () => {
    const first = [
      { id: "b", x: 2, y: 0, width: 2, height: 1 },
      { id: "a", x: 0, y: 0, width: 2, height: 1 },
    ];
    const second = [...first].reverse();

    expect(layoutFingerprint(first)).toBe(layoutFingerprint(second));
    expect(DASHBOARD_COLUMN_COUNT).toBe(6);
  });
});
