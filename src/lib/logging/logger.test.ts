// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { Logger } from "./logger";

describe("Logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts secrets from the message and nested fields", () => {
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line) => output.push(String(line)));

    const logger = new Logger({ minLevel: "debug", scope: "test" });
    logger.info("Failed postgresql://vestyhub:db-password@postgres:5432/vestyhub", {
      ordinaryMessage: "Authorization: Bearer field-token",
      password: "direct-password",
    });

    expect(output).toHaveLength(1);
    const line = output[0] ?? "";
    expect(() => JSON.parse(line)).not.toThrow();
    expect(line).not.toContain("db-password");
    expect(line).not.toContain("field-token");
    expect(line).not.toContain("direct-password");
  });

  it("never throws for circular or hostile values", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    Object.defineProperty(circular, "hostile", {
      enumerable: true,
      get() {
        throw new Error("getter exploded");
      },
    });

    const logger = new Logger();
    expect(() => logger.error("safe", circular)).not.toThrow();
  });
});
