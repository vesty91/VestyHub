// @vitest-environment node

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getEnv } from "@/lib/env";

import { getDockerOverview } from "./client";

vi.mock("@/lib/env", () => ({ getEnv: vi.fn() }));

const servers: Server[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
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

describe("Docker NAS complete JSON body deadline", () => {
  it("returns a safe unavailable state if the proxy never completes a JSON response", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/version") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.write('{"Version":"');
        const interval = setInterval(() => response.write("x"), 30);
        response.once("close", () => clearInterval(interval));
        return;
      }
      if (request.url === "/info") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            Name: "ci-docker-proxy",
            Containers: 0,
            ContainersRunning: 0,
            ContainersPaused: 0,
            ContainersStopped: 0,
            Images: 0,
            NCPU: 4,
            MemTotal: 10000000,
          }),
        );
        return;
      }
      if (request.url === "/containers/json?all=1") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end("[]");
        return;
      }
      response.writeHead(404);
      response.end();
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const port = (server.address() as AddressInfo).port;
    vi.mocked(getEnv).mockReturnValue({
      DOCKER_PROXY_URL: `http://127.0.0.1:${port}`,
      DOCKER_CONTROL_ENABLED: false,
    } as ReturnType<typeof getEnv>);

    const started = performance.now();
    const result = await getDockerOverview();
    expect(result.configured).toBe(true);
    expect(result.available).toBe(false);
    expect(result.containers).toEqual([]);
    expect(performance.now() - started).toBeLessThan(8_000);
  }, 12_000);
});
