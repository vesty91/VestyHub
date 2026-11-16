// @vitest-environment node

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { synologyPostJson } from "./http";

const servers: Server[] = [];

async function fixture(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const request = (baseUrl: string, timeoutMs = 500) => ({
  baseUrl,
  path: "entry.cgi",
  params: new URLSearchParams({ api: "SYNO.Core.System", version: "1", method: "info" }),
  timeoutMs,
  verifyTls: true,
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe("Synology circuit breaker and total deadline", () => {
  it("isolates a NAS returning repeated 503 responses and probes once after cooldown", async () => {
    let requests = 0;
    let recovered = false;
    const url = await fixture((_req, response) => {
      requests++;
      response.writeHead(recovered ? 200 : 503, {
        "Content-Type": "application/json",
      });
      response.end(JSON.stringify({ success: recovered }));
    });

    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    for (let i = 0; i < 3; i++) {
      await expect(synologyPostJson(request(url))).rejects.toMatchObject({
        code: "HTTP_ERROR",
      });
    }
    await expect(synologyPostJson(request(url))).rejects.toMatchObject({
      code: "UNREACHABLE",
    });
    expect(requests).toBe(3);

    clock.mockReturnValue(31_001);
    recovered = true;
    await expect(synologyPostJson(request(url))).resolves.toMatchObject({
      success: true,
    });
    expect(requests).toBe(4);
    await expect(synologyPostJson(request(url))).resolves.toMatchObject({
      success: true,
    });
  });

  it("does not trip for 401 unauthorized requests", async () => {
    let requests = 0;
    const url = await fixture((_req, response) => {
      requests++;
      response.writeHead(401);
      response.end("unauthorized");
    });
    for (let i = 0; i < 4; i++) {
      await expect(synologyPostJson(request(url))).rejects.toMatchObject({
        code: "HTTP_ERROR",
      });
    }
    expect(requests).toBe(4);
  });

  it("aborts a slow trickle response after the total deadline", async () => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const url = await fixture((_req, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.write('{"success":true,"data":"');
      timer = setInterval(() => response.write("x"), 30);
      response.once("close", () => {
        if (timer) clearInterval(timer);
      });
    });
    const started = performance.now();
    await expect(synologyPostJson(request(url, 250))).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    expect(performance.now() - started).toBeLessThan(1_500);
    if (timer) clearInterval(timer);
  });
});
