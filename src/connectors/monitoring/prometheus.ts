import { z } from "zod";

import { ShortTtlCache } from "@/connectors/core/cache";
import { getEnv } from "@/lib/env";

import { MonitoringConnectorError, normalizeMonitoringError } from "./errors";
import { monitoringGetJson, monitoringGetText } from "./http";
import { getMonitoringRangeWindow } from "./range";
import type {
  MonitoringRange,
  MonitoringSourceStatus,
  TimeSeries,
  TimeSeriesUnit,
} from "./types";

const prometheusCache = new ShortTtlCache<TimeSeries[]>({
  ttlMs: 15_000,
  maxEntries: 40,
});

const sampleSchema = z.tuple([z.union([z.number(), z.string()]), z.string()]);
const matrixSeriesSchema = z.object({
  metric: z.record(z.string(), z.string()).default({}),
  values: z.array(sampleSchema).max(5_000),
});
const prometheusMatrixResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    resultType: z.literal("matrix"),
    result: z.array(matrixSeriesSchema).max(200),
  }),
});

export const PROMETHEUS_METRICS = {
  "host.cpu.usage": {
    label: "CPU global",
    unit: "percent",
    query: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
  },
  "host.memory.usage": {
    label: "Mémoire utilisée",
    unit: "percent",
    query: "100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))",
  },
  "host.filesystem.usage": {
    label: "Occupation stockage maximale",
    unit: "percent",
    query:
      'max(100 * (1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|squashfs"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay|squashfs"})))',
  },
  "host.network.receive": {
    label: "Réseau entrant",
    unit: "bytes_per_second",
    query: 'sum(rate(node_network_receive_bytes_total{device!="lo"}[5m]))',
  },
  "host.network.transmit": {
    label: "Réseau sortant",
    unit: "bytes_per_second",
    query: 'sum(rate(node_network_transmit_bytes_total{device!="lo"}[5m]))',
  },
  "docker.containers.running": {
    label: "Conteneurs actifs",
    unit: "count",
    query: 'count(container_last_seen{image!=""})',
  },
} as const satisfies Record<
  string,
  { label: string; unit: TimeSeriesUnit; query: string }
>;

export type PrometheusMetricId = keyof typeof PROMETHEUS_METRICS;

function parseFiniteNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function seriesLabel(metric: Record<string, string>, fallback: string): string {
  const preferred = metric.instance ?? metric.name ?? metric.container ?? metric.device;
  return preferred ? `${fallback} · ${preferred}` : fallback;
}

function normalizeMatrix(metricId: PrometheusMetricId, payload: unknown): TimeSeries[] {
  const parsed = prometheusMatrixResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new MonitoringConnectorError(
      "prometheus",
      "INVALID_RESPONSE",
      "Prometheus returned an invalid matrix response.",
      { cause: parsed.error },
    );
  }

  const definition = PROMETHEUS_METRICS[metricId];
  return parsed.data.data.result
    .map((series, index) => ({
      id: `${metricId}:${index}`,
      label: seriesLabel(series.metric, definition.label),
      unit: definition.unit,
      points: series.values.flatMap(([timestamp, value]) => {
        const numericTimestamp = Number(timestamp);
        const numericValue = parseFiniteNumber(value);
        return Number.isFinite(numericTimestamp) && numericValue !== undefined
          ? [{ timestamp: numericTimestamp, value: numericValue }]
          : [];
      }),
    }))
    .filter((series) => series.points.length > 0);
}

export function isPrometheusMetricId(value: unknown): value is PrometheusMetricId {
  return typeof value === "string" && value in PROMETHEUS_METRICS;
}

export async function getPrometheusStatus(): Promise<MonitoringSourceStatus> {
  const env = getEnv();
  const checkedAt = new Date().toISOString();
  if (!env.PROMETHEUS_URL) {
    return {
      source: "prometheus",
      configured: false,
      available: false,
      checkedAt,
      errorCode: "NOT_CONFIGURED",
    };
  }

  const startedAt = performance.now();
  try {
    await monitoringGetText({
      source: "prometheus",
      connectorName: "Prometheus",
      baseUrl: env.PROMETHEUS_URL,
      path: "/-/ready",
      timeoutMs: env.PROMETHEUS_TIMEOUT_MS,
    });
    return {
      source: "prometheus",
      configured: true,
      available: true,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      checkedAt,
    };
  } catch (error) {
    const normalized = normalizeMonitoringError("prometheus", error);
    return {
      source: "prometheus",
      configured: true,
      available: false,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      checkedAt,
      errorCode: normalized.code,
    };
  }
}

export async function queryPrometheusMetric(
  metricId: PrometheusMetricId,
  range: MonitoringRange,
): Promise<TimeSeries[]> {
  const env = getEnv();
  const definition = PROMETHEUS_METRICS[metricId];
  const window = getMonitoringRangeWindow(range);
  const key = `${metricId}:${range}:${window.endSeconds - (window.endSeconds % window.stepSeconds)}`;

  return prometheusCache.getOrSet(key, async () => {
    const searchParams = new URLSearchParams({
      query: definition.query,
      start: String(window.startSeconds),
      end: String(window.endSeconds),
      step: String(window.stepSeconds),
    });
    const payload = await monitoringGetJson({
      source: "prometheus",
      connectorName: "Prometheus",
      baseUrl: env.PROMETHEUS_URL,
      path: "/api/v1/query_range",
      timeoutMs: env.PROMETHEUS_TIMEOUT_MS,
      searchParams,
    });
    return normalizeMatrix(metricId, payload);
  });
}

export function latestSeriesValue(series: TimeSeries[] | undefined): number | undefined {
  const point = series?.[0]?.points.at(-1);
  return point && Number.isFinite(point.value) ? point.value : undefined;
}
