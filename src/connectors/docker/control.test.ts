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
        "com.docker.compose.project": "wiki",
        "com.docker.compose.service": "app",
      }),
    ).toBe(false);
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
