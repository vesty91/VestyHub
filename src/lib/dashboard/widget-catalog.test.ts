import { describe, expect, it } from "vitest";

import {
  DASHBOARD_WIDGET_CATALOG,
  DASHBOARD_WIDGET_TYPES,
  dashboardWidgetSelectionPayloadSchema,
  dashboardWidgetSettingsPayloadSchema,
  dashboardWidgetTypeSchema,
  dashboardWidgetVisibilityPayloadSchema,
  getDashboardWidgetDefinition,
  getDefaultDashboardWidgetConfiguration,
  parseDashboardWidgetConfiguration,
  resolveDashboardWidgetConfiguration,
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
    expect(getDashboardWidgetDefinition("monitoring")).toMatchObject({
      type: "monitoring",
      title: "Monitoring",
      width: 4,
      height: 2,
    });
  });

  it("accepts only registered widget selections", () => {
    expect(
      dashboardWidgetSelectionPayloadSchema.safeParse({
        dashboardId,
        type: "monitoring",
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

  it("hydrates safe defaults from an empty stored configuration", () => {
    expect(getDefaultDashboardWidgetConfiguration("clock")).toEqual({
      showSeconds: true,
      showDate: true,
      hour12: false,
    });
    expect(getDefaultDashboardWidgetConfiguration("favorites")).toEqual({ limit: 6 });
    expect(getDefaultDashboardWidgetConfiguration("system-status")).toEqual({
      showDatabase: true,
      showDocker: true,
      showSession: true,
    });
    expect(getDefaultDashboardWidgetConfiguration("monitoring")).toEqual({
      range: "1h",
      showAlerts: true,
      showSources: true,
    });
  });

  it("validates settings according to the selected widget type", () => {
    expect(
      dashboardWidgetSettingsPayloadSchema.safeParse({
        dashboardId,
        type: "clock",
        configuration: {
          showSeconds: false,
          showDate: true,
          hour12: false,
        },
      }).success,
    ).toBe(true);

    expect(
      dashboardWidgetSettingsPayloadSchema.safeParse({
        dashboardId,
        type: "favorites",
        configuration: { limit: 9 },
      }).success,
    ).toBe(false);

    expect(
      dashboardWidgetSettingsPayloadSchema.safeParse({
        dashboardId,
        type: "monitoring",
        configuration: {
          range: "24h",
          showAlerts: false,
          showSources: true,
        },
      }).success,
    ).toBe(true);

    expect(
      dashboardWidgetSettingsPayloadSchema.safeParse({
        dashboardId,
        type: "monitoring",
        configuration: {
          range: "30d",
          showAlerts: true,
          showSources: true,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects arbitrary widget configuration keys", () => {
    expect(
      dashboardWidgetSettingsPayloadSchema.safeParse({
        dashboardId,
        type: "monitoring",
        configuration: {
          range: "1h",
          showAlerts: true,
          showSources: true,
          endpoint: "http://example.test",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects arbitrary outer settings keys", () => {
    expect(
      dashboardWidgetSettingsPayloadSchema.safeParse({
        dashboardId,
        type: "favorites",
        configuration: { limit: 4 },
        url: "https://example.test",
      }).success,
    ).toBe(false);
  });

  it("requires at least one system status block", () => {
    expect(() =>
      parseDashboardWidgetConfiguration("system-status", {
        showDatabase: false,
        showDocker: false,
        showSession: false,
      }),
    ).toThrow("Au moins un bloc de statut doit rester affiché.");
  });

  it("falls back to defaults for an invalid stored configuration", () => {
    expect(
      resolveDashboardWidgetConfiguration("monitoring", {
        range: "forever",
        showAlerts: true,
        showSources: true,
      }),
    ).toEqual({
      range: "1h",
      showAlerts: true,
      showSources: true,
    });
  });
});
