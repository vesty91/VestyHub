// @vitest-environment node

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { describe, expect, it } from "vitest";

import { SynologyConnectorError } from "./errors";
import { buildSynologyApiUrl, synologyPostJson } from "./http";

describe("Synology API URL builder", () => {
  it("builds a DSM WebAPI URL without query credentials", () => {
    expect(
      buildSynologyApiUrl("https://nas.example.com:5001", "entry.cgi").toString(),
    ).toBe("https://nas.example.com:5001/webapi/entry.cgi");
  });

  it("preserves an explicit reverse-proxy path prefix", () => {
    expect(buildSynologyApiUrl("https://example.com/dsm/", "entry.cgi").toString()).toBe(
      "https://example.com/dsm/webapi/entry.cgi",
    );
  });

  it("rejects credentials and path traversal", () => {
    expect(() =>
      buildSynologyApiUrl("https://user:secret@example.com", "entry.cgi"),
    ).toThrow(SynologyConnectorError);
    expect(() => buildSynologyApiUrl("https://example.com", "../entry.cgi")).toThrow(
      SynologyConnectorError,
    );
  });
});

describe("Synology API transport", () => {
  it("forwards the SynoToken as an HTTP header", async () => {
    let receivedToken: string | undefined;
    let receivedBody = "";

    const server = createServer((request, response) => {
      receivedToken = request.headers["x-syno-token"] as string | undefined;
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        receivedBody += chunk;
      });
      request.on("end", () => {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: true, data: {} }));
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address() as AddressInfo;
      await synologyPostJson({
        baseUrl: `http://127.0.0.1:${address.port}`,
        path: "entry.cgi",
        params: new URLSearchParams({
          api: "SYNO.Core.System",
          version: "3",
          method: "info",
          _sid: "sid-value",
        }),
        timeoutMs: 1_000,
        verifyTls: true,
        headers: { "X-SYNO-TOKEN": "token-value" },
      });

      expect(receivedToken).toBe("token-value");
      expect(receivedBody).toContain("_sid=sid-value");
      expect(receivedBody).not.toContain("SynoToken");
      expect(receivedBody).not.toContain("token-value");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
