import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  getSessionExpiry,
  hashSessionToken,
  SESSION_DURATION_MS,
} from "./session-token";

describe("session token helpers", () => {
  it("creates high-entropy URL-safe tokens", () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("hashes session tokens deterministically without storing plaintext", () => {
    const token = "example-session-token";
    const hash = hashSessionToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("computes the configured session expiry", () => {
    const now = new Date("2026-08-03T20:00:00.000Z");
    expect(getSessionExpiry(now).getTime() - now.getTime()).toBe(SESSION_DURATION_MS);
  });
});
