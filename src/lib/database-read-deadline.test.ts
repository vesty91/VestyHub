// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DatabaseReadTimeoutError,
  withDatabaseReadDeadline,
} from "./database-read-deadline";

afterEach(() => {
  vi.useRealTimers();
});

describe("read-only PostgreSQL deadlines", () => {
  it("returns a completed query result", async () => {
    await expect(withDatabaseReadDeadline(Promise.resolve([1, 2]), 10)).resolves.toEqual([
      1, 2,
    ]);
  });

  it("preserves the original query error", async () => {
    const expected = new Error("unavailable");
    await expect(withDatabaseReadDeadline(Promise.reject(expected), 10)).rejects.toBe(
      expected,
    );
  });

  it("rejects a never-ending query at the deadline", async () => {
    vi.useFakeTimers();
    const result = withDatabaseReadDeadline(new Promise<never>(() => {}), 8000);
    const assertion = expect(result).rejects.toBeInstanceOf(DatabaseReadTimeoutError);
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
  });

  it("does not treat a later resolution as successful after timing out", async () => {
    vi.useFakeTimers();
    let finish!: (value: string) => void;
    const query = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const result = withDatabaseReadDeadline(query, 20);
    const assertion = expect(result).rejects.toBeInstanceOf(DatabaseReadTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    finish("late");
    await Promise.resolve();
  });
});
