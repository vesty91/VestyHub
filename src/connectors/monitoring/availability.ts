import { publicMonitoringErrorMessage } from "./errors";
import type { MonitoringSourceStatus, MonitoringWarning } from "./types";

export type MonitoringAvailability = "available" | "unreachable" | "not-configured";

/**
 * A missing configuration is intentional, not a service outage.
 * Treat it separately from a configured source that fails health checks.
 */
export function monitoringAvailability(
  status: Pick<MonitoringSourceStatus, "configured" | "available">,
): MonitoringAvailability {
  if (!status.configured) return "not-configured";
  return status.available ? "available" : "unreachable";
}

export function unavailableSourceWarning(
  status: MonitoringSourceStatus,
): MonitoringWarning | null {
  if (monitoringAvailability(status) !== "unreachable") return null;
  const code = status.errorCode ?? "UNREACHABLE";
  return {
    source: status.source,
    code,
    message: publicMonitoringErrorMessage(code),
  };
}

export function hasConfiguredMonitoringSource(
  statuses: readonly MonitoringSourceStatus[],
): boolean {
  return statuses.some((status) => status.configured);
}
