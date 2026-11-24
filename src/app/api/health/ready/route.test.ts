// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/health/database", () => ({
  checkDatabaseReadiness: vi.fn(),
}));
vi.mock("@/lib/logging/logger", () => ({
  logger: { warn: vi.fn() },
}));

import { checkDatabaseReadiness } from "@/lib/health/database";
import { logger } from "@/lib/logging/logger";

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostgreSQL readiness HTTP endpoint", () => {
  it("returns HTTP 503 with no-store and a safe payload during an outage", async () => {
    vi.mocked(checkDatabaseReadiness).mockResolvedValueOnce(false);

    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "not_ready" });
    expect(logger.warn).toHaveBeenCalledWith("Readiness check failed.", {
      dependency: "postgres",
    });
  });

  it("returns HTTP 200 after recovery without leaking database connection data", async () => {
    vi.mocked(checkDatabaseReadiness).mockResolvedValueOnce(true);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ready" });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
