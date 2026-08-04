export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker for "${name}" is open; request rejected.`);
    this.name = "CircuitOpenError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenTrialInProgress = false;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;

    if (
      !Number.isInteger(this.failureThreshold) ||
      this.failureThreshold < 1 ||
      this.failureThreshold > 100
    ) {
      throw new RangeError("failureThreshold must be an integer between 1 and 100.");
    }
    if (!Number.isInteger(this.cooldownMs) || this.cooldownMs < 1) {
      throw new RangeError("cooldownMs must be a positive integer.");
    }
  }

  getState(): CircuitState {
    if (this.state === "open" && Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = "half-open";
    }
    return this.state;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === "open" || (state === "half-open" && this.halfOpenTrialInProgress)) {
      throw new CircuitOpenError(this.name);
    }

    if (state === "half-open") this.halfOpenTrialInProgress = true;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      this.halfOpenTrialInProgress = false;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;
    if (this.state === "half-open" || this.consecutiveFailures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}
