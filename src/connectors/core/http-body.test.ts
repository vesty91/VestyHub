// @vitest-environment node

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { ConnectorAbortedError, ConnectorTimeoutError } from "@/lib/errors";

import { fetchWithTimeoutResult } from "./http";

const servers: Server[] = [];

async function localServer(
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

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe("fetchWithTimeoutResult total HTTP response deadline", () => {
  it("rejects when the server sends headers then trickles a never-ending body", async () => {
    const url = await localServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.write('{"slow":"');
      const interval = setInterval(() => response.write("a"), 30);
      response.once("close", () => clearInterval(interval));
    });

    const started = performance.now();
    await expect(
      fetchWithTimeoutResult(
        url,
        { timeoutMs: 250, connectorName: "Slow JSON" },
        (response) => response.json(),
      ),
    ).rejects.toBeInstanceOf(ConnectorTimeoutError);
    expect(performance.now() - started).toBeLessThan(1_500);
  });

  it("allows a complete body that finishes before the deadline", async () => {
    const url = await localServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });
    await expect(
      fetchWithTimeoutResult(
        url,
        { timeoutMs: 1000, connectorName: "Fast JSON" },
        (response) => response.json(),
      ),
    ).resolves.toEqual({ ok: true });
  });

  it("distinguishes caller cancellation after headers from timeout", async () => {
    const controller = new AbortController();
    let signalFirstChunk: (() => void) | undefined;
    const chunkReady = new Promise<void>((resolve) => {
      signalFirstChunk = resolve;
    });
    const url = await localServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.write("first");
      signalFirstChunk?.();
      const interval = setInterval(() => response.write("more"), 30);
      response.once("close", () => clearInterval(interval));
    });
    const request = fetchWithTimeoutResult(
      url,
      {
        timeoutMs: 1000,
        connectorName: "Cancelled",
        signal: controller.signal,
      },
      (response) => response.text(),
    );
    const rejection = expect(request).rejects.toBeInstanceOf(ConnectorAbortedError);
    await chunkReady;
    controller.abort();
    await rejection;
  });
});
