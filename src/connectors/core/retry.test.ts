// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { retryWithBackoff } from "./retry";

describe("retryWithBackoff", () => {
  it("retries transient failures and returns the successful value", async () => {
    const operation = vi
      .fn(async (): Promise<string> => "ok")
      .mockRejectedValueOnce(new Error("temporary"));

    await expect(
      retryWithBackoff(operation, {
        maxAttempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 0,
      }),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("stops when shouldRetry rejects the error", async () => {
    const operation = vi.fn(async () => {
      throw new Error("permanent");
    });
    await expect(
      retryWithBackoff(operation, {
        maxAttempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow("permanent");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("honours caller cancellation", async () => {
    const controller = new AbortController();
    controller.abort(new Error("caller cancelled"));
    await expect(
      retryWithBackoff(async () => "never", { signal: controller.signal }),
    ).rejects.toThrow("caller cancelled");
  });

  it("validates retry options", async () => {
    await expect(retryWithBackoff(async () => true, { maxAttempts: 0 })).rejects.toThrow(
      RangeError,
    );
    await expect(
      retryWithBackoff(async () => true, { baseDelayMs: 10, maxDelayMs: 5 }),
    ).rejects.toThrow(RangeError);
  });
});
