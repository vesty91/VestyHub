// @vitest-environment node

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { monitoringGetJson, monitoringGetText } from "./http";

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

describe("Monitoring complete-body HTTP deadline", () => {
  it("rejects a never-ending Prometheus JSON body as TIMEOUT", async () => {
    const url = await localServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.write('{"status":"');
      const interval = setInterval(() => response.write("x"), 30);
      response.once("close", () => clearInterval(interval));
    });

    await expect(
      monitoringGetJson({
        source: "prometheus",
        connectorName: "Prometheus",
        baseUrl: url,
        path: "/api/v1/query_range",
        timeoutMs: 250,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("also bounds plain-text readiness probes and recovers after one timeout", async () => {
    let hanging = true;
    const url = await localServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.write("ready");
      if (hanging) {
        const interval = setInterval(() => response.write("x"), 30);
        response.once("close", () => clearInterval(interval));
      } else {
        response.end();
      }
    });
    const options = {
      source: "loki" as const,
      connectorName: "Loki",
      baseUrl: url,
      path: "/ready",
      timeoutMs: 250,
    };
    await expect(monitoringGetText(options)).rejects.toMatchObject({ code: "TIMEOUT" });
    hanging = false;
    await expect(monitoringGetText(options)).resolves.toBe("ready");
  });
});
