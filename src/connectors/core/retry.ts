export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  shouldRetry?: (error: unknown) => boolean;
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Operation aborted.");
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    let settled = false;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const timer = setTimeout(() => {
      settled = true;
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      if (settled) return;
      clearTimeout(timer);
      cleanup();
      reject(signal ? abortReason(signal) : new Error("Operation aborted."));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function validateRetryOptions(
  maxAttempts: number,
  baseDelayMs: number,
  maxDelayMs: number,
): void {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new RangeError("maxAttempts must be an integer between 1 and 10.");
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0 || baseDelayMs > 60_000) {
    throw new RangeError("baseDelayMs must be between 0 and 60000.");
  }
  if (!Number.isFinite(maxDelayMs) || maxDelayMs < baseDelayMs || maxDelayMs > 120_000) {
    throw new RangeError("maxDelayMs must be >= baseDelayMs and <= 120000.");
  }
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 250,
    maxDelayMs = 5000,
    signal,
    shouldRetry = () => true,
  } = options;

  validateRetryOptions(maxAttempts, baseDelayMs, maxDelayMs);
  let lastError: unknown = new Error("Retry operation did not run.");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) throw abortReason(signal);

    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw abortReason(signal);
      if (attempt === maxAttempts || !shouldRetry(error)) break;

      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * exponential * 0.25;
      await delay(exponential + jitter, signal);
    }
  }

  throw lastError;
}
