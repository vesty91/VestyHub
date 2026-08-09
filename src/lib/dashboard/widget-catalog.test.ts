import { describe, expect, it } from "vitest";

import {
  DASHBOARD_WIDGET_CATALOG,
  DASHBOARD_WIDGET_TYPES,
  dashboardWidgetTypeSchema,
  getDashboardWidgetDefinition,
} from "./widget-catalog";

describe("dashboard widget catalog", () => {
  it("contains each registered type exactly once", () => {
    const catalogTypes = DASHBOARD_WIDGET_CATALOG.map((widget) => widget.type);

    expect(catalogTypes).toEqual(DASHBOARD_WIDGET_TYPES);
    expect(new Set(catalogTypes).size).toBe(catalogTypes.length);
  });

  it("rejects unknown widget types", () => {
    expect(dashboardWidgetTypeSchema.safeParse("unknown").success).toBe(false);
  });

  it("exposes bounded positive defaults", () => {
    for (const widget of DASHBOARD_WIDGET_CATALOG) {
      expect(widget.width).toBeGreaterThanOrEqual(widget.minWidth);
      expect(widget.height).toBeGreaterThanOrEqual(widget.minHeight);
      expect(widget.minWidth).toBeGreaterThan(0);
      expect(widget.minHeight).toBeGreaterThan(0);
      expect(widget.refreshInterval).toBeGreaterThanOrEqual(1000);
    }
  });

  it("returns the requested definition", () => {
    expect(getDashboardWidgetDefinition("favorites")).toMatchObject({
      type: "favorites",
      title: "Favoris",
      width: 4,
      height: 2,
    });
  });
});
