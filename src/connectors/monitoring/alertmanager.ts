import { createHash } from "node:crypto";

import { z } from "zod";

import { ShortTtlCache } from "@/connectors/core/cache";
import { getEnv } from "@/lib/env";

import { normalizeMonitoringError } from "./errors";
import { monitoringGetJson, monitoringGetText } from "./http";
import type {
  MonitoringAlert,
  MonitoringAlertSummary,
  MonitoringSourceStatus,
} from "./types";

const alertsCache = new ShortTtlCache<MonitoringAlert[]>({
  ttlMs: 10_000,
  maxEntries: 4,
});

const alertmanagerAlertSchema = z
  .object({
    labels: z.record(z.string(), z.string()).default({}),
    annotations: z.record(z.string(), z.string()).default({}),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    status: z.object({ state: z.string().optional() }).optional(),
    fingerprint: z.string().optional(),
  })
  .passthrough();

const alertmanagerAlertsSchema = z.array(alertmanagerAlertSchema).max(2_000);

function stableAlertId(alert: z.infer<typeof alertmanagerAlertSchema>): string {
  if (alert.fingerprint) return alert.fingerprint;
  return createHash("sha256")
    .update(JSON.stringify([alert.labels, alert.startsAt ?? ""]))
    .digest("hex")
    .slice(0, 24);
}

function normalizeAlert(alert: z.infer<typeof alertmanagerAlertSchema>): MonitoringAlert {
  const rawState = alert.status?.state?.toLowerCase();
  const state = rawState === "pending" ? "pending" : "firing";
  const name = alert.labels.alertname ?? "Alerte sans nom";

  return {
    id: stableAlertId(alert),
    state,
    severity: alert.labels.severity ?? "unknown",
    name,
    summary: alert.annotations.summary ?? alert.annotations.description,
    source: alert.labels.instance ?? alert.labels.job,
    startsAt: alert.startsAt,
    labels: alert.labels,
  };
}

export async function getAlertmanagerStatus(): Promise<MonitoringSourceStatus> {
  const env = getEnv();
  const checkedAt = new Date().toISOString();
  if (!env.ALERTMANAGER_URL) {
    return {
      source: "alertmanager",
      configured: false,
      available: false,
      checkedAt,
      errorCode: "NOT_CONFIGURED",
    };
  }

  const startedAt = performance.now();
  try {
    await monitoringGetText({
      source: "alertmanager",
      connectorName: "Alertmanager",
      baseUrl: env.ALERTMANAGER_URL,
      path: "/-/ready",
      timeoutMs: env.ALERTMANAGER_TIMEOUT_MS,
    });
    return {
      source: "alertmanager",
      configured: true,
      available: true,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      checkedAt,
    };
  } catch (error) {
    const normalized = normalizeMonitoringError("alertmanager", error);
    return {
      source: "alertmanager",
      configured: true,
      available: false,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      checkedAt,
      errorCode: normalized.code,
    };
  }
}

export async function getActiveAlerts(): Promise<MonitoringAlert[]> {
  const env = getEnv();
  return alertsCache.getOrSet("active", async () => {
    const searchParams = new URLSearchParams({
      active: "true",
      silenced: "false",
      inhibited: "false",
    });
    const payload = await monitoringGetJson({
      source: "alertmanager",
      connectorName: "Alertmanager",
      baseUrl: env.ALERTMANAGER_URL,
      path: "/api/v2/alerts",
      timeoutMs: env.ALERTMANAGER_TIMEOUT_MS,
      searchParams,
    });
    return alertmanagerAlertsSchema.parse(payload).map(normalizeAlert);
  });
}

export function summarizeAlerts(alerts: MonitoringAlert[]): MonitoringAlertSummary {
  const bySeverity: Record<string, number> = {};
  let firing = 0;
  let pending = 0;

  for (const alert of alerts) {
    if (alert.state === "pending") pending += 1;
    else firing += 1;
    bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
  }

  return { firing, pending, bySeverity };
}
