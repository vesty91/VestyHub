import { z } from "zod";

import { getEnv } from "@/lib/env";

import { normalizeMonitoringError } from "./errors";
import { monitoringGetJson, monitoringGetText } from "./http";
import { getMonitoringRangeWindow } from "./range";
import type {
  MonitoringLogEntry,
  MonitoringRange,
  MonitoringSourceStatus,
} from "./types";

export const lokiLogSourceSchema = z.enum(["all", "stdout", "stderr"]);
export type LokiLogSource = z.infer<typeof lokiLogSourceSchema>;

const lokiStreamsSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    resultType: z.literal("streams"),
    result: z
      .array(
        z.object({
          stream: z.record(z.string(), z.string()).default({}),
          values: z.array(z.tuple([z.string(), z.string()])).max(1_000),
        }),
      )
      .max(200),
  }),
});

function inferLevel(labels: Record<string, string>, message: string): MonitoringLogEntry["level"] {
  const labelLevel = (labels.level ?? "").toLowerCase();
  if (["debug", "info", "warn", "error"].includes(labelLevel)) {
    return labelLevel as MonitoringLogEntry["level"];
  }

  const normalized = message.toLowerCase();
  if (/\b(error|fatal|panic|exception)\b/.test(normalized)) return "error";
  if (/\b(warn|warning)\b/.test(normalized)) return "warn";
  if (/\bdebug\b/.test(normalized)) return "debug";
  if (/\b(info|notice)\b/.test(normalized)) return "info";
  return "unknown";
}

function timestampFromNanoseconds(value: string): string | undefined {
  try {
    const milliseconds = Number(BigInt(value) / 1_000_000n);
    if (!Number.isFinite(milliseconds)) return undefined;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  } catch {
    return undefined;
  }
}

function buildLogQuery(source: LokiLogSource, searchText?: string): string {
  const selector =
    source === "all" ? '{job="docker"}' : `{job="docker",stream="${source}"}`;
  const boundedSearch = searchText?.trim().slice(0, 200);
  return boundedSearch ? `${selector} |= ${JSON.stringify(boundedSearch)}` : selector;
}

export async function getLokiStatus(): Promise<MonitoringSourceStatus> {
  const env = getEnv();
  const checkedAt = new Date().toISOString();
  if (!env.LOKI_URL) {
    return {
      source: "loki",
      configured: false,
      available: false,
      checkedAt,
      errorCode: "NOT_CONFIGURED",
    };
  }

  const startedAt = performance.now();
  try {
    await monitoringGetText({
      source: "loki",
      connectorName: "Loki",
      baseUrl: env.LOKI_URL,
      path: "/ready",
      timeoutMs: env.LOKI_TIMEOUT_MS,
    });
    return {
      source: "loki",
      configured: true,
      available: true,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      checkedAt,
    };
  } catch (error) {
    const normalized = normalizeMonitoringError("loki", error);
    return {
      source: "loki",
      configured: true,
      available: false,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      checkedAt,
      errorCode: normalized.code,
    };
  }
}

export async function getLokiLogs(options: {
  range: MonitoringRange;
  source: LokiLogSource;
  searchText?: string;
  limit?: number;
}): Promise<MonitoringLogEntry[]> {
  const env = getEnv();
  const window = getMonitoringRangeWindow(options.range);
  const limit = Math.min(500, Math.max(1, Math.trunc(options.limit ?? 200)));
  const searchParams = new URLSearchParams({
    query: buildLogQuery(options.source, options.searchText),
    start: `${window.startSeconds}000000000`,
    end: `${window.endSeconds}000000000`,
    limit: String(limit),
    direction: "backward",
  });

  const payload = await monitoringGetJson({
    source: "loki",
    connectorName: "Loki",
    baseUrl: env.LOKI_URL,
    path: "/loki/api/v1/query_range",
    timeoutMs: env.LOKI_TIMEOUT_MS,
    searchParams,
  });
  const parsed = lokiStreamsSchema.parse(payload);

  return parsed.data.result
    .flatMap((stream, streamIndex) =>
      stream.values.flatMap(([rawTimestamp, rawMessage], lineIndex) => {
        const timestamp = timestampFromNanoseconds(rawTimestamp);
        if (!timestamp) return [];
        const message = rawMessage.slice(0, 4_000);
        return [
          {
            id: `${rawTimestamp}:${streamIndex}:${lineIndex}`,
            timestamp,
            source: stream.stream.container ?? stream.stream.service ?? stream.stream.job ?? "docker",
            level: inferLevel(stream.stream, message),
            message,
            labels: stream.stream,
          } satisfies MonitoringLogEntry,
        ];
      }),
    )
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, limit);
}
