import { describe, expect, it } from "vitest";

import {
  DASHBOARD_WIDGET_CATALOG,
  DASHBOARD_WIDGET_TYPES,
  dashboardWidgetSelectionPayloadSchema,
  dashboardWidgetTypeSchema,
  dashboardWidgetVisibilityPayloadSchema,
  getDashboardWidgetDefinition,
} from "./widget-catalog";

const dashboardId = "11111111-1111-4111-8111-111111111111";

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

  it("accepts only registered widget selections", () => {
    expect(
      dashboardWidgetSelectionPayloadSchema.safeParse({
        dashboardId,
        type: "clock",
      }).success,
    ).toBe(true);
    expect(
      dashboardWidgetSelectionPayloadSchema.safeParse({
        dashboardId,
        type: "custom",
      }).success,
    ).toBe(false);
  });

  it("requires an explicit boolean visibility state", () => {
    expect(
      dashboardWidgetVisibilityPayloadSchema.safeParse({
        dashboardId,
        type: "system-status",
        isVisible: false,
      }).success,
    ).toBe(true);
    expect(
      dashboardWidgetVisibilityPayloadSchema.safeParse({
        dashboardId,
        type: "system-status",
        isVisible: "false",
      }).success,
    ).toBe(false);
  });
});
