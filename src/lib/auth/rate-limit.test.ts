import { beforeEach, describe, expect, it } from "vitest";

import {
  checkLoginRateLimit,
  clearLoginRateLimitsForTests,
  recordLoginFailure,
  resetLoginRateLimit,
} from "./rate-limit";

describe("login rate limiter", () => {
  beforeEach(() => clearLoginRateLimitsForTests());

  it("allows initial attempts", () => {
    expect(checkLoginRateLimit("client", 1_000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("blocks after five failures", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordLoginFailure("client", 1_000 + attempt);
    }

    const decision = checkLoginRateLimit("client", 2_000);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after a successful login", () => {
    recordLoginFailure("client", 1_000);
    resetLoginRateLimit("client");
    expect(checkLoginRateLimit("client", 1_001).allowed).toBe(true);
  });
});
