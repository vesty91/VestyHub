// @vitest-environment node
import { describe, expect, it } from "vitest";

import { redactSensitiveData, redactSensitiveString } from "./redact";

describe("redactSensitiveData", () => {
  it("masks known sensitive keys and secrets hidden inside ordinary strings", () => {
    const result = redactSensitiveData({
      username: "admin",
      password: "hunter2",
      nested: {
        apiKey: "abc123",
        message: "Bearer abc.def.ghi",
        database: "postgresql://vestyhub:sup3rsecret@postgres:5432/vestyhub",
      },
      sessions: [{ access_token: "xyz" }],
    }) as Record<string, unknown>;

    expect(result.username).toBe("admin");
    expect(result.password).toBe("[REDACTED]");
    expect((result.nested as Record<string, unknown>).apiKey).toBe("[REDACTED]");
    expect(JSON.stringify(result)).not.toContain("hunter2");
    expect(JSON.stringify(result)).not.toContain("abc.def.ghi");
    expect(JSON.stringify(result)).not.toContain("sup3rsecret");
    expect(JSON.stringify(result)).not.toContain("xyz");
  });

  it("handles cycles, Error, BigInt, Map, Set, and binary data", () => {
    const input: Record<string, unknown> = {
      count: BigInt(12),
      map: new Map([["authorization", "Bearer secret-token"]]),
      set: new Set(["password=visible-no-more"]),
      bytes: new Uint8Array([1, 2, 3]),
      error: new Error("token=do-not-log"),
    };
    input.self = input;

    const result = redactSensitiveData(input);
    const serialised = JSON.stringify(result);

    expect(serialised).toContain("[Circular]");
    expect(serialised).toContain("12");
    expect(serialised).toContain("Binary 3 bytes");
    expect(serialised).not.toContain("secret-token");
    expect(serialised).not.toContain("do-not-log");
  });
});

describe("redactSensitiveString", () => {
  it("masks headers, cookies, URL credentials, query tokens, and assignments", () => {
    const input = [
      "Authorization: Bearer abc.def.ghi",
      "Cookie: session=very-secret",
      "postgresql://vestyhub:sup3rsecret@postgres:5432/vestyhub",
      "https://service.local/callback?access_token=token-value&ok=1",
      "client_secret=client-value",
    ].join("\n");

    const result = redactSensitiveString(input);
    for (const secret of [
      "abc.def.ghi",
      "very-secret",
      "sup3rsecret",
      "token-value",
      "client-value",
    ]) {
      expect(result).not.toContain(secret);
    }
  });
});
