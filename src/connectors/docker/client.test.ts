// @vitest-environment node

import { describe, expect, it } from "vitest";

import { calculateUptimeSeconds, sanitizeServiceUrl } from "./client";

describe("sanitizeServiceUrl", () => {
  it("accepts HTTP and HTTPS URLs", () => {
    expect(sanitizeServiceUrl("http://nas.local:3000")).toBe("http://nas.local:3000/");
    expect(sanitizeServiceUrl("https://service.example.test/path")).toBe(
      "https://service.example.test/path",
    );
  });

  it("rejects dangerous or invalid protocols", () => {
    expect(sanitizeServiceUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeServiceUrl("data:text/html,test")).toBeUndefined();
    expect(sanitizeServiceUrl("file:///etc/passwd")).toBeUndefined();
    expect(sanitizeServiceUrl("not a url")).toBeUndefined();
  });
});

describe("calculateUptimeSeconds", () => {
  const nowMs = Date.parse("2026-08-04T12:00:00Z");

  it("ignores Docker's zero timestamp for a never-started container", () => {
    expect(
      calculateUptimeSeconds("created", "0001-01-01T00:00:00Z", undefined, nowMs),
    ).toBeUndefined();
  });

  it("ignores an invalid start timestamp", () => {
    expect(
      calculateUptimeSeconds("running", "not-a-date", undefined, nowMs),
    ).toBeUndefined();
  });

  it("calculates one hour for a running container", () => {
    expect(
      calculateUptimeSeconds(
        "running",
        "2026-08-04T11:00:00Z",
        undefined,
        nowMs,
      ),
    ).toBe(3600);
  });

  it("calculates the completed runtime for an exited container", () => {
    expect(
      calculateUptimeSeconds(
        "exited",
        "2026-08-04T11:00:00Z",
        "2026-08-04T11:10:00Z",
        nowMs,
      ),
    ).toBe(600);
  });

  it("returns undefined for an exited container without a valid finish timestamp", () => {
    expect(
      calculateUptimeSeconds(
        "exited",
        "2026-08-04T11:00:00Z",
        "0001-01-01T00:00:00Z",
        nowMs,
      ),
    ).toBeUndefined();
  });

  it("never returns a negative uptime for a future start timestamp", () => {
    expect(
      calculateUptimeSeconds(
        "running",
        "2026-08-04T13:00:00Z",
        undefined,
        nowMs,
      ),
    ).toBe(0);
  });
});
