import { describe, expect, it } from "vitest";

import { appendResourceHistory, RESOURCE_HISTORY_WINDOW_MS } from "./history";

const sample = (time: number, cpu: number, memory: number) => ({
  sampledAt: new Date(1_700_000_000_000 + time * 1000).toISOString(),
  cpu: { usagePercent: cpu, logicalCores: 24 },
  memory: { usagePercent: memory, totalBytes: 32, usedBytes: 20 },
});

describe("five-minute local resource history", () => {
  it("accepts distinct measured CPU and RAM readings", () => {
    const first = appendResourceHistory([], sample(0, 15, 85));
    const second = appendResourceHistory(first, sample(15, 25, 86));
    expect(second).toHaveLength(2);
    expect(second[1]).toEqual({
      sampledAt: sample(15, 25, 86).sampledAt,
      cpu: 25,
      memory: 86,
    });
  });

  it("never duplicates a cached response or accepts an older sample", () => {
    const first = appendResourceHistory([], sample(15, 25, 86));
    expect(appendResourceHistory(first, sample(15, 60, 99))).toBe(first);
    expect(appendResourceHistory(first, sample(10, 30, 90))).toBe(first);
  });

  it("prunes data older than five minutes without losing the boundary", () => {
    let history = [sample(0, 10, 20), sample(1, 15, 25)].map((item) => ({
      sampledAt: item.sampledAt,
      cpu: item.cpu.usagePercent,
      memory: item.memory.usagePercent,
    }));
    history = appendResourceHistory(
      history,
      sample(RESOURCE_HISTORY_WINDOW_MS / 1000 + 1, 60, 80),
    );
    expect(history).toHaveLength(2);
    expect(history[0].cpu).toBe(15);
    expect(history[1].cpu).toBe(60);
  });

  it("discards impossible values and malformed timestamps", () => {
    const first = appendResourceHistory([], sample(10, 20, 30));
    expect(appendResourceHistory(first, sample(11, NaN, 50))).toBe(first);
    expect(appendResourceHistory(first, sample(11, -1, 50))).toBe(first);
    expect(appendResourceHistory(first, sample(11, 20, 101))).toBe(first);
    expect(
      appendResourceHistory(first, { ...sample(11, 20, 30), sampledAt: "invalid" }),
    ).toBe(first);
  });

  it("bounds sample count even under unusually frequent updates", () => {
    let history: ReturnType<typeof appendResourceHistory> = [];
    for (let index = 0; index < 100; index += 1) {
      history = appendResourceHistory(history, sample(index, 10, 30));
    }
    expect(history).toHaveLength(64);
    expect(history[0].sampledAt).toBe(sample(36, 10, 30).sampledAt);
  });
});
