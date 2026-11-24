// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getEnv } from "@/lib/env";

import { getDockerOverview } from "./client";

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn(),
}));

describe("Docker NAS connector when intentionally unconfigured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnv).mockReturnValue({
      DOCKER_PROXY_URL: "",
      DOCKER_CONTROL_ENABLED: false,
    } as ReturnType<typeof getEnv>);
  });

  it("never contacts the network and reports disabled instead of failure", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDockerOverview();
    expect(result).toMatchObject({
      configured: false,
      available: false,
      partial: false,
      counters: { total: 0, running: 0, unhealthy: 0 },
      containers: [],
      warnings: [],
      error: "Source Docker NAS non configurée.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
