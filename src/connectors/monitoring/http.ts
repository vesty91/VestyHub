import { fetchWithTimeout } from "@/connectors/core/http";

import { MonitoringConnectorError, normalizeMonitoringError } from "./errors";
import type { MonitoringSource } from "./types";

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

async function monitoringGet({
  source,
  connectorName,
  baseUrl,
  path,
  timeoutMs,
  searchParams,
}: MonitoringRequestOptions): Promise<Response> {
  if (!baseUrl) {
    throw new MonitoringConnectorError(
      source,
      "NOT_CONFIGURED",
      "Source not configured.",
    );
  }

  try {
    const url = buildMonitoringUrl(source, baseUrl, path, searchParams);
    const response = await fetchWithTimeout(url, {
      method: "GET",
      timeoutMs,
      connectorName,
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "application/json, text/plain;q=0.9" },
    });

    if (!response.ok) {
      throw new MonitoringConnectorError(
        source,
        "HTTP_ERROR",
        `${connectorName} returned HTTP ${response.status}.`,
      );
    }

    return response;
  } catch (error) {
    throw normalizeMonitoringError(source, error);
  }
}

export async function monitoringGetJson(
  options: MonitoringRequestOptions,
): Promise<unknown> {
  const response = await monitoringGet(options);
  try {
    return await response.json();
  } catch (error) {
    throw new MonitoringConnectorError(
      options.source,
      "INVALID_RESPONSE",
      `${options.connectorName} returned invalid JSON.`,
      { cause: error },
    );
  }
}

export async function monitoringGetText(
  options: MonitoringRequestOptions,
): Promise<string> {
  const response = await monitoringGet(options);
  return response.text();
}
