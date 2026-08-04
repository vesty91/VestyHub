/**
 * Union of connector kinds. Kept as a plain TS union (not a DB enum) so new
 * connectors can be added without a migration — see
 * `src/db/schema/connectors.ts`.
 */
export const CONNECTOR_TYPES = [
  "docker",
  "prometheus",
  "loki",
  "alertmanager",
  "synology",
  "healthcheck",
  // Planned, not yet implemented:
  "proxmox",
  "truenas",
  "home-assistant",
  "pihole",
  "adguard",
  "unifi",
  "pfsense",
  "opnsense",
  "github",
  "gitlab",
] as const;

export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export type ConnectorCapability =
  "summary" | "health" | "metrics-history" | "logs" | "topology" | "control";

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  checkedAt: string;
}

export interface ConnectorSummary {
  connectorId: string;
  type: ConnectorType;
  headline: string;
  metrics: Record<string, string | number | boolean | null>;
  generatedAt: string;
}

export type HealthStatus =
  "available" | "unavailable" | "degraded" | "maintenance" | "unknown";

export interface ConnectorHealth {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}
