// @vitest-environment node

import { describe, expect, it } from "vitest";

import { mapDsmErrorCode, publicSynologyErrorMessage } from "./errors";

describe("Synology DSM errors", () => {
  it("maps authentication and permission errors", () => {
    expect(mapDsmErrorCode(400)).toBe("AUTH_FAILED");
    expect(mapDsmErrorCode(402)).toBe("PERMISSION_DENIED");
    expect(mapDsmErrorCode(403)).toBe("TWO_FACTOR_REQUIRED");
    expect(mapDsmErrorCode(119)).toBe("SESSION_EXPIRED");
  });

  it("maps unsupported APIs and methods", () => {
    expect(mapDsmErrorCode(102)).toBe("API_UNAVAILABLE");
    expect(mapDsmErrorCode(103)).toBe("API_UNAVAILABLE");
    expect(mapDsmErrorCode(104)).toBe("API_UNAVAILABLE");
  });

  it("provides public messages without DSM internals", () => {
    expect(publicSynologyErrorMessage("AUTH_FAILED")).toBe("Identifiants DSM refusés.");
    expect(publicSynologyErrorMessage("TLS_ERROR")).not.toContain("certificate chain");
  });
});
