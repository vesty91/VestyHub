// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { monitoringGetText } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const input = (source: "prometheus" | "loki" = "prometheus") => ({
  source,
  connectorName: source,
  baseUrl: "http://127.0.0.1:9999",
  path: "/-/ready",
  timeoutMs: 1000,
});

describe("monitoring per-source circuit breakers", () => {
  it("stops repeated unreachable requests and permits a recovery probe", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const f = vi.fn().mockRejectedValue(new TypeError("Network is offline"));
    vi.stubGlobal("fetch", f);

    for (let i = 0; i < 4; i++) {
      await expect(monitoringGetText(input())).rejects.toMatchObject({
        code: "UNREACHABLE",
      });
    }
    expect(f).toHaveBeenCalledTimes(3);

    f.mockImplementation(async () => new Response("ready", { status: 200 }));
    now.mockReturnValue(31_001);

    expect(await monitoringGetText(input())).toBe("ready");
    expect(f).toHaveBeenCalledTimes(4);
    expect(await monitoringGetText(input())).toBe("ready");
    expect(f).toHaveBeenCalledTimes(5);
  });

  it("an unavailable Prometheus does not isolate Loki", async () => {
    const f = vi.fn(async (input: URL | string) => {
      if (String(input).includes("prometheus")) throw new TypeError("offline");
      return new Response("ready");
    });
    vi.stubGlobal("fetch", f);
    const prometheus = { ...input(), baseUrl: "http://prometheus.internal" };
    const loki = { ...input("loki"), baseUrl: "http://loki.internal" };

    for (let i = 0; i < 3; i++) {
      await expect(monitoringGetText(prometheus)).rejects.toMatchObject({
        code: "UNREACHABLE",
      });
    }
    await expect(monitoringGetText(prometheus)).rejects.toMatchObject({
      code: "UNREACHABLE",
    });
    expect(await monitoringGetText(loki)).toBe("ready");
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("does not open the circuit for a permanent HTTP 401 response", async () => {
    const f = vi.fn(async () => new Response("forbidden", { status: 401 }));
    vi.stubGlobal("fetch", f);
    for (let i = 0; i < 4; i++) {
      await expect(monitoringGetText(input("loki"))).rejects.toMatchObject({
        code: "HTTP_ERROR",
      });
    }
    expect(f).toHaveBeenCalledTimes(4);
  });
});
