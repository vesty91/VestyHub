// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { execute: vi.fn() },
}));

import { db } from "@/db";

import { checkDatabaseReadiness } from "./database";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("PostgreSQL readiness", () => {
  it("accepts a successful read-only SELECT 1", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as never);
    await expect(checkDatabaseReadiness()).resolves.toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("returns false safely when PostgreSQL rejects the query", async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error("private database URL"));
    await expect(checkDatabaseReadiness()).resolves.toBe(false);
  });

  it("bounds an unresponsive query to three seconds, without any write", async () => {
    vi.useFakeTimers();
    vi.mocked(db.execute).mockImplementationOnce(() => new Promise(() => {}) as never);

    const result = checkDatabaseReadiness();
    const expectation = expect(result).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    await expectation;
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});
