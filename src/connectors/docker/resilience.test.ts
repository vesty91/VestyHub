// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { getEnv } from "@/lib/env";

import { getDockerOverview } from "./client";

vi.mock("@/lib/env", () => ({ getEnv: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Docker NAS read circuit breaker", () => {
  it("stops retrying a missing read proxy after repeated failures", async () => {
    vi.mocked(getEnv).mockReturnValue({
      DOCKER_PROXY_URL: "http://docker-nas-read.invalid:2375",
      DOCKER_EXPECTED_HOSTNAME: "restorpc",
      DOCKER_CONTROL_ENABLED: false,
    } as ReturnType<typeof getEnv>);

    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const fetchMock = vi.fn(async () => {
      throw new TypeError("connection refused");
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await getDockerOverview();
    expect(first.available).toBe(false);
    expect(first.configured).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // The negative cache expires, but an OPEN circuit fails immediately.
    now.mockReturnValue(7000);
    const second = await getDockerOverview();
    expect(second.available).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // After 30s, only one half-open request may probe the remote host.
    now.mockReturnValue(32_000);
    const third = await getDockerOverview();
    expect(third.available).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
