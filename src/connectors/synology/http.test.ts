// @vitest-environment node

import { describe, expect, it } from "vitest";

import { SynologyConnectorError } from "./errors";
import { buildSynologyApiUrl } from "./http";

describe("Synology API URL builder", () => {
  it("builds a DSM WebAPI URL without query credentials", () => {
    expect(buildSynologyApiUrl("https://nas.example.com:5001", "entry.cgi").toString()).toBe(
      "https://nas.example.com:5001/webapi/entry.cgi",
    );
  });

  it("preserves an explicit reverse-proxy path prefix", () => {
    expect(buildSynologyApiUrl("https://example.com/dsm/", "entry.cgi").toString()).toBe(
      "https://example.com/dsm/webapi/entry.cgi",
    );
  });

  it("rejects credentials and path traversal", () => {
    expect(() => buildSynologyApiUrl("https://user:secret@example.com", "entry.cgi")).toThrow(
      SynologyConnectorError,
    );
    expect(() => buildSynologyApiUrl("https://example.com", "../entry.cgi")).toThrow(
      SynologyConnectorError,
    );
  });
});
