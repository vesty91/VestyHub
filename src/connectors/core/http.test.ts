// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectorAbortedError, ConnectorTimeoutError } from "@/lib/errors";

import { fetchWithTimeout } from "./http";

function abortableFetch(): typeof fetch {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        return;
      }
      signal?.addEventListener(
        "abort",
        () => reject(signal.reason ?? new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  }) as typeof fetch;
}

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reports an internal timeout distinctly", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", abortableFetch());

    const request = fetchWithTimeout("https://service.example", {
      timeoutMs: 100,
      connectorName: "Grafana",
    });
    const rejection = expect(request).rejects.toBeInstanceOf(ConnectorTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });

  it("reports caller cancellation distinctly", async () => {
    vi.stubGlobal("fetch", abortableFetch());
    const controller = new AbortController();
    const request = fetchWithTimeout("https://service.example", {
      timeoutMs: 1000,
      connectorName: "Grafana",
      signal: controller.signal,
    });
    controller.abort(new Error("cancelled by test"));
    await expect(request).rejects.toBeInstanceOf(ConnectorAbortedError);
  });

  it("rejects an already-aborted signal without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchWithTimeout("https://service.example", {
        timeoutMs: 1000,
        connectorName: "Grafana",
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(ConnectorAbortedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates timeout bounds", async () => {
    await expect(
      fetchWithTimeout("https://service.example", {
        timeoutMs: 0,
        connectorName: "Grafana",
      }),
    ).rejects.toThrow(RangeError);
  });
});
