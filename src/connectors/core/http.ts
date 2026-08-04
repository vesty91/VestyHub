import { ConnectorAbortedError, ConnectorTimeoutError } from "@/lib/errors";

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs: number;
  connectorName: string;
  signal?: AbortSignal;
}

function validateTimeout(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new RangeError("timeoutMs must be an integer between 1 and 120000.");
  }
}

export async function fetchWithTimeout(
  input: string | URL,
  { timeoutMs, connectorName, signal, ...init }: FetchWithTimeoutOptions,
): Promise<Response> {
  validateTimeout(timeoutMs);

  if (signal?.aborted) {
    throw new ConnectorAbortedError(connectorName);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Connector timeout"));
  }, timeoutMs);

  const onExternalAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new ConnectorTimeoutError(connectorName, timeoutMs);
    }
    if (signal?.aborted) {
      throw new ConnectorAbortedError(connectorName);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
