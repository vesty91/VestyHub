// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getActiveAlerts,
  getAlertmanagerStatus,
} from "@/connectors/monitoring/alertmanager";
import { getLokiStatus } from "@/connectors/monitoring/loki";
import {
  getPrometheusStatus,
  queryPrometheusMetric,
} from "@/connectors/monitoring/prometheus";

vi.mock("@/connectors/monitoring/alertmanager", () => ({
  getAlertmanagerStatus: vi.fn(),
  getActiveAlerts: vi.fn(),
  summarizeAlerts: vi.fn(() => ({ firing: 0, pending: 0, bySeverity: {} })),
}));
vi.mock("@/connectors/monitoring/loki", () => ({ getLokiStatus: vi.fn() }));
vi.mock("@/connectors/monitoring/prometheus", () => ({
  getPrometheusStatus: vi.fn(),
  queryPrometheusMetric: vi.fn(),
  latestSeriesValue: vi.fn(() => undefined),
  PROMETHEUS_METRICS: {
    "host.cpu.usage": { label: "CPU global" },
  },
}));

const at = "2026-11-16T16:00:00.000Z";

describe("monitoring overview when connectors are disabled or down", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPrometheusStatus).mockResolvedValue({
      source: "prometheus",
      configured: false,
      available: false,
      errorCode: "NOT_CONFIGURED",
      checkedAt: at,
    });
    vi.mocked(getLokiStatus).mockResolvedValue({
      source: "loki",
      configured: false,
      available: false,
      errorCode: "NOT_CONFIGURED",
      checkedAt: at,
    });
    vi.mocked(getAlertmanagerStatus).mockResolvedValue({
      source: "alertmanager",
      configured: false,
      available: false,
      errorCode: "NOT_CONFIGURED",
      checkedAt: at,
    });
  });

  it("does not report optional unconfigured sources as outages or invent alert counts", async () => {
    const { getMonitoringOverview } = await import("./service");
    const overview = await getMonitoringOverview("1h");
    expect(overview.sources).toHaveLength(3);
    expect(overview.sources.every((status) => !status.configured)).toBe(true);
    expect(overview.warnings).toEqual([]);
    expect(overview.alerts).toBeNull();
    expect(overview.summary.cpuPercent).toBeUndefined();
    expect(queryPrometheusMetric).not.toHaveBeenCalled();
    expect(getActiveAlerts).not.toHaveBeenCalled();
  });

  it("does warn when a configured source is unreachable, without affecting disabled peers", async () => {
    vi.mocked(getPrometheusStatus).mockResolvedValue({
      source: "prometheus",
      configured: true,
      available: false,
      errorCode: "TIMEOUT",
      checkedAt: at,
    });
    const { getMonitoringOverview } = await import("./service");
    const overview = await getMonitoringOverview("6h");
    expect(overview.warnings).toEqual([
      {
        source: "prometheus",
        code: "TIMEOUT",
        message: "Délai de réponse dépassé.",
      },
    ]);
    expect(queryPrometheusMetric).not.toHaveBeenCalled();
  });
});
