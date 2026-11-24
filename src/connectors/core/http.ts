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

/**
 * A single deadline for both HTTP headers and the entire response body.
 * The provided reader must consume the body before it resolves; otherwise
 * only the headers are protected. The timer is always cleaned up.
 */
export async function fetchWithTimeoutResult<T>(
  input: string | URL,
  { timeoutMs, connectorName, signal, ...init }: FetchWithTimeoutOptions,
  read: (response: Response) => Promise<T> | T,
): Promise<T> {
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
    const response = await fetch(input, { ...init, signal: controller.signal });
    return await read(response);
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

/**
 * Header-only compatibility API: intended for requests where callers do not
 * consume a response body (e.g. Docker POST actions).
 * Use fetchWithTimeoutResult for JSON/text to cover slow or stalled bodies.
 */
export async function fetchWithTimeout(
  input: string | URL,
  options: FetchWithTimeoutOptions,
): Promise<Response> {
  return fetchWithTimeoutResult(input, options, (response) => response);
}
