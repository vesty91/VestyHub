import { z } from "zod";

import { fetchWithTimeout } from "@/connectors/core/http";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging/logger";

const dockerLogger = logger.child("docker");

const dockerVersionSchema = z.object({
  Version: z.string(),
  ApiVersion: z.string(),
  Os: z.string(),
  Arch: z.string(),
});

const dockerInfoSchema = z.object({
  Name: z.string(),
  Containers: z.number(),
  ContainersRunning: z.number(),
  ContainersPaused: z.number(),
  ContainersStopped: z.number(),
  Images: z.number(),
  NCPU: z.number(),
  MemTotal: z.number(),
  DockerRootDir: z.string().optional(),
  OperatingSystem: z.string().optional(),
});

const dockerContainerSchema = z.object({
  Id: z.string(),
  Names: z.array(z.string()),
  Image: z.string(),
  State: z.string(),
  Status: z.string(),
  Created: z.number(),
  Labels: z.record(z.string(), z.string()).optional().default({}),
  Ports: z
    .array(
      z.object({
        IP: z.string().optional(),
        PrivatePort: z.number(),
        PublicPort: z.number().optional(),
        Type: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export type DockerContainerSummary = z.infer<typeof dockerContainerSchema>;

export interface DockerOverview {
  available: boolean;
  error?: string;
  engine?: {
    name: string;
    version: string;
    apiVersion: string;
    os: string;
    arch: string;
    operatingSystem?: string;
    cpus: number;
    memoryBytes: number;
    images: number;
    containers: number;
    running: number;
    paused: number;
    stopped: number;
  };
  containers: DockerContainerSummary[];
}

function dockerUrl(path: string): URL | null {
  const baseUrl = getEnv().DOCKER_PROXY_URL;
  if (!baseUrl) {
    return null;
  }
  return new URL(path.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`);
}

async function dockerGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const url = dockerUrl(path);
  if (!url) {
    throw new Error("Docker proxy is not configured.");
  }

  const response = await fetchWithTimeout(url, {
    timeoutMs: 5_000,
    connectorName: "Docker",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Docker API returned HTTP ${response.status}.`);
  }

  return schema.parse(await response.json());
}

export async function getDockerOverview(): Promise<DockerOverview> {
  try {
    const [version, info, containers] = await Promise.all([
      dockerGet("version", dockerVersionSchema),
      dockerGet("info", dockerInfoSchema),
      dockerGet("containers/json?all=1", z.array(dockerContainerSchema)),
    ]);

    return {
      available: true,
      engine: {
        name: info.Name,
        version: version.Version,
        apiVersion: version.ApiVersion,
        os: version.Os,
        arch: version.Arch,
        operatingSystem: info.OperatingSystem,
        cpus: info.NCPU,
        memoryBytes: info.MemTotal,
        images: info.Images,
        containers: info.Containers,
        running: info.ContainersRunning,
        paused: info.ContainersPaused,
        stopped: info.ContainersStopped,
      },
      containers,
    };
  } catch (error) {
    dockerLogger.warn("Unable to read Docker overview.", { error });
    return {
      available: false,
      error: "Le proxy Docker ne répond pas actuellement.",
      containers: [],
    };
  }
}
