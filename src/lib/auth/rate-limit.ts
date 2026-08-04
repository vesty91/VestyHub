interface RateLimitEntry {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_ENTRIES = 10_000;

const entries = new Map<string, RateLimitEntry>();

function prune(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.blockedUntil <= now && now - entry.windowStartedAt > WINDOW_MS) {
      entries.delete(key);
    }
  }

  if (entries.size <= MAX_ENTRIES) {
    return;
  }

  for (const key of entries.keys()) {
    if (entries.size <= MAX_ENTRIES) {
      break;
    }
    entries.delete(key);
  }
}

export function checkLoginRateLimit(key: string, now = Date.now()): RateLimitDecision {
  prune(now);
  const entry = entries.get(key);

  if (!entry || entry.blockedUntil <= now) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)),
  };
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  prune(now);
  const current = entries.get(key);

  if (!current || now - current.windowStartedAt > WINDOW_MS) {
    entries.set(key, {
      failures: 1,
      windowStartedAt: now,
      blockedUntil: 0,
    });
    return;
  }

  current.failures += 1;
  if (current.failures >= MAX_FAILURES) {
    current.blockedUntil = now + BLOCK_MS;
  }
  entries.set(key, current);
}

export function resetLoginRateLimit(key: string): void {
  entries.delete(key);
}

export function clearLoginRateLimitsForTests(): void {
  entries.clear();
}
