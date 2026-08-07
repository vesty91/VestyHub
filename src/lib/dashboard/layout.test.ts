import { describe, expect, it } from "vitest";

import {
  DASHBOARD_COLUMN_COUNT,
  DASHBOARD_MAX_WIDGETS,
  dashboardLayoutPayloadSchema,
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
    const widgets = Array.from(
      { length: DASHBOARD_MAX_WIDGETS + 1 },
      (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        x: 0,
        y: index,
        width: 1,
        height: 1,
      }),
    );

    expect(
      dashboardLayoutPayloadSchema.safeParse({ dashboardId, widgets }).success,
    ).toBe(false);
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
