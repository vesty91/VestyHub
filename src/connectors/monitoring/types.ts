export const MONITORING_RANGES = ["1h", "6h", "24h", "7d"] as const;

export type MonitoringRange = (typeof MONITORING_RANGES)[number];
export type MonitoringSource = "prometheus" | "loki" | "alertmanager";
export type MonitoringErrorCode =
  "NOT_CONFIGURED" | "TIMEOUT" | "UNREACHABLE" | "HTTP_ERROR" | "INVALID_RESPONSE";

export interface MonitoringSourceStatus {
  source: MonitoringSource;
  configured: boolean;
  available: boolean;
  latencyMs?: number;
  checkedAt: string;
  errorCode?: MonitoringErrorCode;
}

export type TimeSeriesUnit =
  "percent" | "bytes" | "bytes_per_second" | "count" | "seconds";

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface TimeSeries {
  id: string;
  label: string;
  unit: TimeSeriesUnit;
  points: TimeSeriesPoint[];
}

export interface MonitoringWarning {
  source: MonitoringSource;
  code: MonitoringErrorCode | "PARTIAL_DATA";
  message: string;
}

export interface MonitoringMetricSummary {
  cpuPercent?: number;
  memoryPercent?: number;
  filesystemPercent?: number;
  networkReceiveBytesPerSecond?: number;
  networkTransmitBytesPerSecond?: number;
  runningContainers?: number;
}

export interface MonitoringAlert {
  id: string;
  state: "firing" | "pending";
  severity: string;
  name: string;
  summary?: string;
  source?: string;
  startsAt?: string;
  labels: Record<string, string>;
}

export interface MonitoringAlertSummary {
  firing: number;
  pending: number;
  bySeverity: Record<string, number>;
}

export interface MonitoringLogEntry {
  id: string;
  timestamp: string;
  source: string;
  level: "debug" | "info" | "warn" | "error" | "unknown";
  message: string;
  labels: Record<string, string>;
}

export interface MonitoringOverview {
  generatedAt: string;
  range: MonitoringRange;
  sources: MonitoringSourceStatus[];
  summary: MonitoringMetricSummary;
  metrics: Record<string, TimeSeries[]>;
  alerts: MonitoringAlertSummary | null;
  warnings: MonitoringWarning[];
}
