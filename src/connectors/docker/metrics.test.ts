import { describe, expect, it } from "vitest";

import { calculateCpuPercent, calculateMemoryMetrics } from "./metrics";

describe("Docker metrics", () => {
  it("calculates CPU percentage", () => {
    expect(
      calculateCpuPercent(
        {
          cpu_usage: { total_usage: 300, percpu_usage: [1, 1] },
          system_cpu_usage: 1000,
          online_cpus: 2,
        },
        { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
      ),
    ).toBe(80);
  });

  it("returns zero when system delta is zero", () => {
    expect(
      calculateCpuPercent(
        { cpu_usage: { total_usage: 300 }, system_cpu_usage: 500 },
        { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
      ),
    ).toBe(0);
  });

  it("falls back to the per-cpu array length", () => {
    expect(
      calculateCpuPercent(
        {
          cpu_usage: { total_usage: 200, percpu_usage: [1, 1, 1, 1] },
          system_cpu_usage: 1000,
        },
        { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
      ),
    ).toBe(80);
  });

  it("subtracts inactive_file from memory usage", () => {
    expect(
      calculateMemoryMetrics({
        usage: 1000,
        limit: 2000,
        stats: { inactive_file: 200 },
      }),
    ).toEqual({
      memoryUsageBytes: 800,
      memoryLimitBytes: 2000,
      memoryPercent: 40,
    });
  });

  it("supports total_inactive_file and a zero limit", () => {
    expect(
      calculateMemoryMetrics({
        usage: 100,
        limit: 0,
        stats: { total_inactive_file: 150 },
      }),
    ).toEqual({
      memoryUsageBytes: 0,
      memoryLimitBytes: 0,
      memoryPercent: 0,
    });
  });
});
