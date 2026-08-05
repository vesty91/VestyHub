import { ShortTtlCache } from "@/connectors/core/cache";
import {
  getActiveAlerts,
  getAlertmanagerStatus,
  summarizeAlerts,
} from "@/connectors/monitoring/alertmanager";
import {
  normalizeMonitoringError,
  publicMonitoringErrorMessage,
} from "@/connectors/monitoring/errors";
import { getLokiStatus } from "@/connectors/monitoring/loki";
import {
  getPrometheusStatus,
  latestSeriesValue,
  PROMETHEUS_METRICS,
  queryPrometheusMetric,
  type PrometheusMetricId,
} from "@/connectors/monitoring/prometheus";
import type {
  MonitoringOverview,
  MonitoringRange,
  MonitoringSource,
  MonitoringWarning,
  TimeSeries,
} from "@/connectors/monitoring/types";
import { assertServerOnly } from "@/lib/security/assert-server";

assertServerOnly("lib/monitoring/service");

const overviewCache = new ShortTtlCache<MonitoringOverview>({
  ttlMs: 10_000,
  maxEntries: 8,
});
const metricIds = Object.keys(PROMETHEUS_METRICS) as PrometheusMetricId[];

function warningForError(source: MonitoringSource, error: unknown): MonitoringWarning {
  const normalized = normalizeMonitoringError(source, error);
  return {
    source,
    code: normalized.code,
    message: publicMonitoringErrorMessage(normalized.code),
  };
}

async function loadMonitoringOverview(
  range: MonitoringRange,
): Promise<MonitoringOverview> {
  const generatedAt = new Date().toISOString();
  const warnings: MonitoringWarning[] = [];
  const [prometheusStatus, lokiStatus, alertmanagerStatus] = await Promise.all([
    getPrometheusStatus(),
    getLokiStatus(),
    getAlertmanagerStatus(),
  ]);

  const metrics: Record<string, TimeSeries[]> = {};
  if (prometheusStatus.available) {
    const metricResults = await Promise.allSettled(
      metricIds.map(
        async (metricId) =>
          [metricId, await queryPrometheusMetric(metricId, range)] as const,
      ),
    );

    metricResults.forEach((result, index) => {
      const metricId = metricIds[index]!;
      if (result.status === "fulfilled") {
        metrics[result.value[0]] = result.value[1];
        if (result.value[1].length === 0) {
          warnings.push({
            source: "prometheus",
            code: "PARTIAL_DATA",
            message: `Aucune série disponible pour ${PROMETHEUS_METRICS[metricId].label}.`,
          });
        }
      } else {
        warnings.push(warningForError("prometheus", result.reason));
      }
    });
  } else {
    warnings.push({
      source: "prometheus",
      code: prometheusStatus.errorCode ?? "UNREACHABLE",
      message: publicMonitoringErrorMessage(prometheusStatus.errorCode ?? "UNREACHABLE"),
    });
  }

  let alerts = null;
  if (alertmanagerStatus.available) {
    try {
      alerts = summarizeAlerts(await getActiveAlerts());
    } catch (error) {
      warnings.push(warningForError("alertmanager", error));
    }
  } else {
    warnings.push({
      source: "alertmanager",
      code: alertmanagerStatus.errorCode ?? "UNREACHABLE",
      message: publicMonitoringErrorMessage(
        alertmanagerStatus.errorCode ?? "UNREACHABLE",
      ),
    });
  }

  if (!lokiStatus.available) {
    warnings.push({
      source: "loki",
      code: lokiStatus.errorCode ?? "UNREACHABLE",
      message: publicMonitoringErrorMessage(lokiStatus.errorCode ?? "UNREACHABLE"),
    });
  }

  return {
    generatedAt,
    range,
    sources: [prometheusStatus, lokiStatus, alertmanagerStatus],
    summary: {
      cpuPercent: latestSeriesValue(metrics["host.cpu.usage"]),
      memoryPercent: latestSeriesValue(metrics["host.memory.usage"]),
      filesystemPercent: latestSeriesValue(metrics["host.filesystem.usage"]),
      networkReceiveBytesPerSecond: latestSeriesValue(metrics["host.network.receive"]),
      networkTransmitBytesPerSecond: latestSeriesValue(metrics["host.network.transmit"]),
      runningContainers: latestSeriesValue(metrics["docker.containers.running"]),
    },
    metrics,
    alerts,
    warnings,
  };
}

export async function getMonitoringOverview(
  range: MonitoringRange,
): Promise<MonitoringOverview> {
  return overviewCache.getOrSet(range, () => loadMonitoringOverview(range));
}
