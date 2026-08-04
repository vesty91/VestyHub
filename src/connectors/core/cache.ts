interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessedAt: number;
}

export interface ShortTtlCacheOptions {
  ttlMs: number;
  maxEntries?: number;
}

export class ShortTtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: number | ShortTtlCacheOptions) {
    const resolved = typeof options === "number" ? { ttlMs: options } : options;
    if (!Number.isInteger(resolved.ttlMs) || resolved.ttlMs < 1) {
      throw new RangeError("ttlMs must be a positive integer.");
    }
    const maxEntries = resolved.maxEntries ?? 250;
    if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 10_000) {
      throw new RangeError("maxEntries must be an integer between 1 and 10000.");
    }
    this.ttlMs = resolved.ttlMs;
    this.maxEntries = maxEntries;
  }

  get size(): number {
    return this.store.size;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    entry.lastAccessedAt = Date.now();
    return entry.value;
  }

  set(key: string, value: T): void {
    this.purgeExpired();
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      this.evictLeastRecentlyUsed();
    }
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      lastAccessedAt: now,
    });
  }

  async getOrSet(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = factory()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  purgeExpired(now = Date.now()): number {
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.store) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) this.store.delete(oldestKey);
  }
}
