// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker";

describe("CircuitBreaker", () => {
  it("opens after the threshold and permits only one half-open trial", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    const breaker = new CircuitBreaker("prometheus", {
      failureThreshold: 1,
      cooldownMs: 100,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(breaker.getState()).toBe("open");
    await expect(breaker.execute(async () => "blocked")).rejects.toBeInstanceOf(
      CircuitOpenError,
    );

    clock.mockReturnValue(1100);
    let finishTrial: ((value: string) => void) | undefined;
    const trial = breaker.execute(
      () =>
        new Promise<string>((resolve) => {
          finishTrial = resolve;
        }),
    );
    await expect(breaker.execute(async () => "second")).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    finishTrial?.("healthy");
    await expect(trial).resolves.toBe("healthy");
    expect(breaker.getState()).toBe("closed");
  });

  it("validates its limits", () => {
    expect(() => new CircuitBreaker("x", { failureThreshold: 0 })).toThrow(RangeError);
    expect(() => new CircuitBreaker("x", { cooldownMs: 0 })).toThrow(RangeError);
  });
});
