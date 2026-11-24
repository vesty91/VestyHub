// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  dockerActionPath,
  dockerContainerActionSchema,
  isProtectedVestyHubContainer,
} from "./control";

describe("docker control", () => {
  it("accepts only a Docker id and an allowed action", () => {
    expect(
      dockerContainerActionSchema.safeParse({
        containerId: "0123456789ab",
        action: "restart",
      }).success,
    ).toBe(true);
    expect(
      dockerContainerActionSchema.safeParse({
        containerId: "../containers/json",
        action: "delete",
      }).success,
    ).toBe(false);
  });

  it("protects the VestyHub control plane", () => {
    expect(
      isProtectedVestyHubContainer({
        "com.docker.compose.project": "vestyhub",
        "com.docker.compose.service": "app",
      }),
    ).toBe(true);
    expect(
      isProtectedVestyHubContainer({
        "com.docker.compose.project": "vestyhub-nas-deploy",
        "com.docker.compose.service": "migrate",
      }),
    ).toBe(true);
    expect(
      isProtectedVestyHubContainer({
        "com.docker.compose.project": "vestyhub-docker-proxy",
        "com.docker.compose.service": "vestyhub-docker-proxy",
      }),
    ).toBe(true);
    expect(
      isProtectedVestyHubContainer({
        "com.docker.compose.project": "wiki",
        "com.docker.compose.service": "app",
      }),
    ).toBe(false);
    expect(isProtectedVestyHubContainer({}, ["/vestyhub-manual-app"])).toBe(true);
    expect(isProtectedVestyHubContainer({ "vestyhub.protected": "true" })).toBe(true);
  });

  it("adds a bounded grace period to stop and restart", () => {
    expect(dockerActionPath("0123456789ab", "start")).toBe(
      "containers/0123456789ab/start",
    );
    expect(dockerActionPath("0123456789ab", "stop")).toBe(
      "containers/0123456789ab/stop?t=10",
    );
  });
});
