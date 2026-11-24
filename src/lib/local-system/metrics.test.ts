import { describe, expect, it } from "vitest";

import { calculateCpuUsage, calculateUsage } from "./metrics";

const times = (idle: number, user: number) => ({
  idle,
  user,
  nice: 0,
  sys: 0,
  irq: 0,
});

describe("Windows local resource calculations", () => {
  it("uses CPU time deltas instead of raw cumulative counters", () => {
    expect(calculateCpuUsage([times(200, 100)], [times(250, 150)])).toBe(50);
    expect(calculateCpuUsage([times(200, 100)], [times(300, 100)])).toBe(0);
  });

  it("aggregates usage across logical processors", () => {
    expect(
      calculateCpuUsage(
        [times(200, 200), times(200, 200)],
        [times(250, 250), times(220, 280)],
      ),
    ).toBe(65);
  });

  it("ignores an invalid or incomplete sample", () => {
    expect(calculateCpuUsage([], [])).toBe(0);
    expect(calculateCpuUsage([times(1, 2)], [])).toBe(0);
    expect(calculateCpuUsage([times(100, 100)], [times(50, 50)])).toBe(0);
  });

  it("bounds storage and memory usage percentages", () => {
    expect(calculateUsage(100, 30)).toBe(70);
    expect(calculateUsage(100, 110)).toBe(0);
    expect(calculateUsage(100, -5)).toBe(100);
    expect(calculateUsage(0, 0)).toBe(0);
  });
});
