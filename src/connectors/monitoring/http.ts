import { CircuitBreaker } from "@/connectors/core/circuit-breaker";
import { fetchWithTimeoutResult } from "@/connectors/core/http";

import { MonitoringConnectorError, normalizeMonitoringError } from "./errors";
import type { MonitoringSource } from "./types";

// Separate circuits: an offline Loki never blocks a healthy Prometheus.
// State is process-local; there are no background probes or server writes.
const sourceBreakers: Record<MonitoringSource, CircuitBreaker> = {
  prometheus: newBreaker("prometheus"),
  loki: newBreaker("loki"),
  alertmanager: newBreaker("alertmanager"),
};

function newBreaker(source: MonitoringSource): CircuitBreaker {
  return new CircuitBreaker(source, {
    failureThreshold: 3,
    cooldownMs: 30_000,
    shouldTrip: (error) => {
      const normalized = normalizeMonitoringError(source, error);
      return (
        normalized.code === "TIMEOUT" ||
        normalized.code === "UNREACHABLE" ||
        (normalized.code === "HTTP_ERROR" &&
          error instanceof Error &&
          /HTTP 5[0-9][0-9]/.test(error.message))
      );
    },
  });
}

interface MonitoringRequestOptions {
  source: MonitoringSource;
  connectorName: string;
  baseUrl: string;
  path: string;
  timeoutMs: number;
  searchParams?: URLSearchParams;
}

function buildMonitoringUrl(
  source: MonitoringSource,
  baseUrl: string,
  path: string,
  searchParams?: URLSearchParams,
) {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch (error) {
    throw new MonitoringConnectorError(
      source,
      "NOT_CONFIGURED",
      "Monitoring source URL is invalid.",
      { cause: error },
    );
  }

  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new MonitoringConnectorError(
      source,
      "NOT_CONFIGURED",
      "Monitoring source URL must use HTTP or HTTPS.",
    );
  }

  const url = new URL(path.replace(/^\//, ""), `${base.toString().replace(/\/$/, "")}/`);
  if (searchParams) url.search = searchParams.toString();
  return url;
}

async function monitoringGet<T>(
  {
    source,
    connectorName,
    baseUrl,
    path,
    timeoutMs,
    searchParams,
  }: MonitoringRequestOptions,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  if (!baseUrl) {
    throw new MonitoringConnectorError(
      source,
      "NOT_CONFIGURED",
      "Source not configured.",
    );
  }

  try {
    const url = buildMonitoringUrl(source, baseUrl, path, searchParams);
    // The circuit breaker must observe failures during body consumption,
    // not only errors while the remote server sends HTTP headers.
    return await sourceBreakers[source].execute(() =>
      fetchWithTimeoutResult(
        url,
        {
          method: "GET",
          timeoutMs,
          connectorName,
          redirect: "error",
          cache: "no-store",
          headers: { Accept: "application/json, text/plain;q=0.9" },
        },
        async (response) => {
          if (!response.ok) {
            void response.body?.cancel();
            throw new MonitoringConnectorError(
              source,
              "HTTP_ERROR",
              `${connectorName} returned HTTP ${response.status}.`,
            );
          }
          return read(response);
        },
      ),
    );
  } catch (error) {
    throw normalizeMonitoringError(source, error);
  }
}

export function monitoringGetJson(options: MonitoringRequestOptions): Promise<unknown> {
  return monitoringGet(options, (response) => response.json());
}

export function monitoringGetText(options: MonitoringRequestOptions): Promise<string> {
  return monitoringGet(options, (response) => response.text());
}
