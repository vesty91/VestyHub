// @vitest-environment node

import { describe, expect, it } from "vitest";

import { getMonitoringRangeWindow, parseMonitoringRange } from "./range";

describe("monitoring ranges", () => {
  it("accepts supported ranges and falls back safely", () => {
    expect(parseMonitoringRange("1h")).toBe("1h");
    expect(parseMonitoringRange("7d")).toBe("7d");
    expect(parseMonitoringRange("30d")).toBe("1h");
    expect(parseMonitoringRange(undefined)).toBe("1h");
  });

  it("computes a bounded window and step", () => {
    const nowMs = Date.UTC(2026, 7, 4, 20, 0, 0);
    expect(getMonitoringRangeWindow("1h", nowMs)).toEqual({
      startSeconds: nowMs / 1000 - 3600,
      endSeconds: nowMs / 1000,
      stepSeconds: 15,
    });
    expect(getMonitoringRangeWindow("7d", nowMs).stepSeconds).toBe(1800);
  });
});
