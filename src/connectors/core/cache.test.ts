// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { ShortTtlCache } from "./cache";

describe("ShortTtlCache", () => {
  it("shares one in-flight factory per key", async () => {
    const cache = new ShortTtlCache<number>({ ttlMs: 1000, maxEntries: 10 });
    let resolveFactory: ((value: number) => void) | undefined;
    const factory = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFactory = resolve;
        }),
    );

    const first = cache.getOrSet("same", factory);
    const second = cache.getOrSet("same", factory);
    expect(factory).toHaveBeenCalledTimes(1);
    resolveFactory?.(42);
    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    expect(cache.get("same")).toBe(42);
  });

  it("expires entries and enforces the maximum size", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1000);
    const cache = new ShortTtlCache<number>({ ttlMs: 100, maxEntries: 2 });
    cache.set("a", 1);
    now.mockReturnValue(1001);
    cache.set("b", 2);
    now.mockReturnValue(1002);
    cache.get("a");
    now.mockReturnValue(1003);
    cache.set("c", 3);

    expect(cache.size).toBe(2);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);

    now.mockReturnValue(1200);
    expect(cache.purgeExpired()).toBe(2);
    expect(cache.size).toBe(0);
  });

  it("validates cache limits", () => {
    expect(() => new ShortTtlCache(0)).toThrow(RangeError);
    expect(() => new ShortTtlCache({ ttlMs: 100, maxEntries: 0 })).toThrow(RangeError);
  });
});
