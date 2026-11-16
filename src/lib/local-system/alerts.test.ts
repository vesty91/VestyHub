import { describe, expect, it } from "vitest";

import {
  advanceResourceAlerts,
  DEFAULT_RESOURCE_THRESHOLDS,
  initialResourceAlertState,
} from "./alerts";

const metric = (seconds: number, cpu: number, memory: number) => ({
  sampledAt: new Date(1_700_000_000_000 + seconds * 1000).toISOString(),
  cpu: { usagePercent: cpu, logicalCores: 24 },
  memory: { usagePercent: memory, totalBytes: 32, usedBytes: 16 },
});

describe("local resource alert hysteresis", () => {
  it("needs two distinct high samples and does not count cache duplicates", () => {
    const initial = initialResourceAlertState();
    const one = advanceResourceAlerts(
      initial,
      metric(1, 97, 40),
      DEFAULT_RESOURCE_THRESHOLDS,
    );
    expect(one.cpu.active).toBe(false);
    expect(one.cpu.highCount).toBe(1);
    expect(
      advanceResourceAlerts(one, metric(1, 97, 40), DEFAULT_RESOURCE_THRESHOLDS),
    ).toBe(one);
    const two = advanceResourceAlerts(
      one,
      metric(2, 96, 45),
      DEFAULT_RESOURCE_THRESHOLDS,
    );
    expect(two.cpu.active).toBe(true);
    expect(two.memory.active).toBe(false);
  });

  it("only clears after two recovery samples below the hysteresis band", () => {
    let state = initialResourceAlertState();
    for (const sample of [metric(1, 20, 95), metric(2, 20, 94)]) {
      state = advanceResourceAlerts(state, sample, DEFAULT_RESOURCE_THRESHOLDS);
    }
    expect(state.memory.active).toBe(true);
    state = advanceResourceAlerts(state, metric(3, 20, 83), DEFAULT_RESOURCE_THRESHOLDS);
    expect(state.memory.active).toBe(true);
    state = advanceResourceAlerts(state, metric(4, 20, 79), DEFAULT_RESOURCE_THRESHOLDS);
    expect(state.memory.active).toBe(true);
    state = advanceResourceAlerts(state, metric(5, 20, 80), DEFAULT_RESOURCE_THRESHOLDS);
    expect(state.memory.active).toBe(false);
  });

  it("resets an incomplete high sequence when load returns to normal", () => {
    let state = initialResourceAlertState();
    state = advanceResourceAlerts(state, metric(1, 90, 20), DEFAULT_RESOURCE_THRESHOLDS);
    state = advanceResourceAlerts(state, metric(2, 89, 20), DEFAULT_RESOURCE_THRESHOLDS);
    state = advanceResourceAlerts(state, metric(3, 91, 20), DEFAULT_RESOURCE_THRESHOLDS);
    expect(state.cpu.active).toBe(false);
    expect(state.cpu.highCount).toBe(1);
  });

  it("ignores malformed or older samples and invalid usage", () => {
    const state = advanceResourceAlerts(
      initialResourceAlertState(),
      metric(10, 95, 90),
      DEFAULT_RESOURCE_THRESHOLDS,
    );
    expect(
      advanceResourceAlerts(state, metric(9, 95, 90), DEFAULT_RESOURCE_THRESHOLDS),
    ).toBe(state);
    expect(
      advanceResourceAlerts(
        state,
        { ...metric(11, 95, 90), sampledAt: "bad-date" },
        DEFAULT_RESOURCE_THRESHOLDS,
      ),
    ).toBe(state);
    const invalid = advanceResourceAlerts(
      state,
      metric(11, NaN, -1),
      DEFAULT_RESOURCE_THRESHOLDS,
    );
    expect(invalid.cpu).toEqual(state.cpu);
    expect(invalid.memory).toEqual(state.memory);
  });

  it("counts the two metrics independently and supports valid custom thresholds", () => {
    const limits = { cpu: 75, memory: 95 };
    let state = initialResourceAlertState();
    state = advanceResourceAlerts(state, metric(1, 80, 90), limits);
    state = advanceResourceAlerts(state, metric(2, 85, 96), limits);
    expect(state.cpu.active).toBe(true);
    expect(state.memory.active).toBe(false);
    state = advanceResourceAlerts(state, metric(3, 50, 97), limits);
    expect(state.memory.active).toBe(true);
    expect(state.cpu.active).toBe(true);
  });
});
