import { z } from "zod";

import { ShortTtlCache } from "@/connectors/core/cache";
import { fetchWithTimeout } from "@/connectors/core/http";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging/logger";

import { calculateCpuPercent, calculateMemoryMetrics } from "./metrics";
import {
  dockerActionPath,
  isProtectedVestyHubContainer,
  type DockerContainerAction,
} from "./control";
import type {
  DockerContainer,
  DockerContainerState,
  DockerHealthStatus,
  DockerOverview,
} from "./types";

const dockerLogger = logger.child("docker");
const overviewCache = new ShortTtlCache<DockerOverview>(5_000);
const inspectCache = new ShortTtlCache<z.infer<typeof dockerInspectSchema>>(5_000);
const statsCache = new ShortTtlCache<z.infer<typeof dockerStatsSchema>>(3_000);

const dockerVersionSchema = z
  .object({
    Version: z.string(),
    ApiVersion: z.string(),
    Os: z.string(),
    Arch: z.string(),
  })
  .passthrough();

const dockerInfoSchema = z
  .object({
    Name: z.string(),
    Containers: z.number(),
    ContainersRunning: z.number(),
    ContainersPaused: z.number(),
    ContainersStopped: z.number(),
    Images: z.number(),
    NCPU: z.number(),
    MemTotal: z.number(),
    OperatingSystem: z.string().optional(),
  })
  .passthrough();

const dockerContainerSchema = z
  .object({
    Id: z.string(),
    Names: z.array(z.string()),
    Image: z.string(),
    State: z.string(),
    Status: z.string(),
    Created: z.number(),
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
  })
  .passthrough();

const dockerInspectSchema = z
  .object({
    RestartCount: z.number().optional().default(0),
    State: z
      .object({
        StartedAt: z.string().optional(),
        FinishedAt: z.string().optional(),
        Health: z.object({ Status: z.string() }).optional(),
      })
      .passthrough(),
    Config: z
      .object({
        Labels: z.record(z.string(), z.string()).nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const dockerStatsSchema = z
  .object({
    cpu_stats: z
      .object({
        cpu_usage: z
          .object({
            total_usage: z.number().optional(),
            percpu_usage: z.array(z.number()).optional(),
          })
          .optional(),
        system_cpu_usage: z.number().optional(),
        online_cpus: z.number().optional(),
      })
      .optional(),
    precpu_stats: z
      .object({
        cpu_usage: z.object({ total_usage: z.number().optional() }).optional(),
        system_cpu_usage: z.number().optional(),
      })
      .optional(),
    memory_stats: z
      .object({
        usage: z.number().optional(),
        limit: z.number().optional(),
        stats: z
          .object({
            inactive_file: z.number().optional(),
            total_inactive_file: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

function dockerUrl(path: string): URL | null {
  const baseUrl = getEnv().DOCKER_PROXY_URL;
  if (!baseUrl) return null;
  return new URL(path.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`);
}

function dockerControlUrl(path: string): URL | null {
  const baseUrl = getEnv().DOCKER_CONTROL_PROXY_URL;
  if (!baseUrl) return null;
  return new URL(path.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`);
}

async function dockerGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const url = dockerUrl(path);
  if (!url) throw new Error("Docker proxy is not configured.");

  const response = await fetchWithTimeout(url, {
    timeoutMs: 5_000,
    connectorName: "Docker NAS",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error(`Docker API returned HTTP ${response.status}.`);
  return schema.parse(await response.json());
}

async function dockerControlInfo(): Promise<z.infer<typeof dockerInfoSchema>> {
  const url = dockerControlUrl("info");
  if (!url) throw new Error("Docker control proxy is not configured.");

  const response = await fetchWithTimeout(url, {
    timeoutMs: 5_000,
    connectorName: "Docker NAS control",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Docker control proxy returned HTTP ${response.status}.`);
  }
  return dockerInfoSchema.parse(await response.json());
}

async function dockerPost(path: string): Promise<void> {
  const url = dockerControlUrl(path);
  if (!url) throw new Error("Docker control proxy is not configured.");

  const response = await fetchWithTimeout(url, {
    method: "POST",
    timeoutMs: 15_000,
    connectorName: "Docker NAS",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok && response.status !== 304) {
    throw new Error(`Docker API returned HTTP ${response.status}.`);
  }
}

function normalizeState(value: string): DockerContainerState {
  const allowed: DockerContainerState[] = [
    "running",
    "exited",
    "paused",
    "restarting",
    "created",
    "dead",
    "removing",
  ];
  return allowed.includes(value as DockerContainerState)
    ? (value as DockerContainerState)
    : "unknown";
}

function normalizeHealth(value?: string): DockerHealthStatus {
  if (!value) return "none";
  if (["healthy", "unhealthy", "starting"].includes(value)) {
    return value as DockerHealthStatus;
  }
  return "unknown";
}

function parseDockerTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}

export function calculateUptimeSeconds(
  state: DockerContainerState,
  startedAt?: string,
  finishedAt?: string,
  nowMs = Date.now(),
): number | undefined {
  if (state === "created") return undefined;

  const startedMs = parseDockerTimestamp(startedAt);
  if (startedMs === undefined) return undefined;

  if (state === "running" || state === "restarting" || state === "paused") {
    if (!Number.isFinite(nowMs)) return undefined;
    return Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  }

  if (state !== "exited" && state !== "dead" && state !== "removing") {
    return undefined;
  }

  const finishedMs = parseDockerTimestamp(finishedAt);
  if (finishedMs === undefined || finishedMs < startedMs) return undefined;

  return Math.floor((finishedMs - startedMs) / 1000);
}

export function sanitizeServiceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let index = 0;
  async function worker() {
    while (index < values.length) {
      const current = index++;
      results[current] = await mapper(values[current]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

async function enrichContainer(
  container: z.infer<typeof dockerContainerSchema>,
): Promise<DockerContainer> {
  const id = container.Id;
  const state = normalizeState(container.State);
  const warnings: string[] = [];
  let inspect: z.infer<typeof dockerInspectSchema> | undefined;
  let stats: z.infer<typeof dockerStatsSchema> | undefined;

  try {
    inspect = await inspectCache.getOrSet(id, () =>
      dockerGet(`containers/${encodeURIComponent(id)}/json`, dockerInspectSchema),
    );
  } catch {
    warnings.push("Inspection indisponible");
  }

  if (state === "running") {
    try {
      stats = await statsCache.getOrSet(id, () =>
        dockerGet(
          `containers/${encodeURIComponent(id)}/stats?stream=false`,
          dockerStatsSchema,
        ),
      );
    } catch {
      warnings.push("Métriques indisponibles");
    }
  }

  const labels = inspect?.Config.Labels ?? {};
  const rawStartedAt = inspect?.State.StartedAt;
  const startedAt =
    parseDockerTimestamp(rawStartedAt) === undefined ? undefined : rawStartedAt;
  const uptimeSeconds = calculateUptimeSeconds(
    state,
    startedAt,
    inspect?.State.FinishedAt,
  );
  const cpuPercent = calculateCpuPercent(stats?.cpu_stats, stats?.precpu_stats);
  const memory = calculateMemoryMetrics(stats?.memory_stats);
  const metricsAvailable = Boolean(stats);

  return {
    id: id.slice(0, 12),
    name: container.Names[0]?.replace(/^\//, "") || id.slice(0, 12),
    image: container.Image,
    state,
    health: normalizeHealth(inspect?.State.Health?.Status),
    status: container.Status,
    createdAt: new Date(container.Created * 1000).toISOString(),
    startedAt,
    uptimeSeconds,
    restartCount: inspect?.RestartCount ?? 0,
    ports: container.Ports.map((port) => ({
      ip: port.IP,
      privatePort: port.PrivatePort,
      publicPort: port.PublicPort,
      protocol: port.Type,
    })),
    composeProject: labels["com.docker.compose.project"],
    composeService: labels["com.docker.compose.service"],
    serviceUrl: sanitizeServiceUrl(labels["vestyhub.url"] ?? labels["homepage.href"]),
    metrics: metricsAvailable ? { cpuPercent, ...memory } : undefined,
    metricsAvailable,
    warning: warnings.length ? warnings.join(" · ") : undefined,
  };
}

async function loadDockerOverview(): Promise<DockerOverview> {
  const fetchedAt = new Date().toISOString();
  if (!getEnv().DOCKER_PROXY_URL) {
    // No connection attempt or warning for an optional, disabled NAS source.
    return {
      configured: false,
      available: false,
      partial: false,
      fetchedAt,
      counters: { total: 0, running: 0, paused: 0, stopped: 0, unhealthy: 0 },
      containers: [],
      warnings: [],
      error: "Source Docker NAS non configurée.",
    };
  }
  try {
    const [version, info, rawContainers] = await Promise.all([
      dockerGet("version", dockerVersionSchema),
      dockerGet("info", dockerInfoSchema),
      dockerGet("containers/json?all=1", z.array(dockerContainerSchema)),
    ]);

    const expected = getEnv().DOCKER_EXPECTED_HOSTNAME;
    if (expected && info.Name.toLowerCase() !== expected.toLowerCase()) {
      return {
        configured: true,
        available: false,
        partial: false,
        fetchedAt,
        counters: { total: 0, running: 0, paused: 0, stopped: 0, unhealthy: 0 },
        containers: [],
        warnings: [],
        error: `Source Docker refusée : hôte reçu « ${info.Name} », NAS attendu « ${expected} ».`,
      };
    }

    const containers = await mapWithConcurrency(rawContainers, 4, enrichContainer);
    const warnings = containers.flatMap((container) =>
      container.warning ? [`${container.name}: ${container.warning}`] : [],
    );

    return {
      configured: true,
      available: true,
      partial: warnings.length > 0,
      fetchedAt,
      engine: {
        name: info.Name,
        source: "NAS Synology",
        version: version.Version,
        apiVersion: version.ApiVersion,
        os: version.Os,
        arch: version.Arch,
        operatingSystem: info.OperatingSystem,
        cpus: info.NCPU,
        memoryBytes: info.MemTotal,
        images: info.Images,
      },
      counters: {
        total: info.Containers,
        running: info.ContainersRunning,
        paused: info.ContainersPaused,
        stopped: info.ContainersStopped,
        unhealthy: containers.filter((container) => container.health === "unhealthy")
          .length,
      },
      containers,
      warnings,
    };
  } catch (error) {
    dockerLogger.warn("Unable to read NAS Docker overview.", { error });
    return {
      configured: true,
      available: false,
      partial: false,
      fetchedAt,
      counters: { total: 0, running: 0, paused: 0, stopped: 0, unhealthy: 0 },
      containers: [],
      warnings: [],
      error: "Le proxy Docker du NAS ne répond pas actuellement.",
    };
  }
}

export async function getDockerOverview(): Promise<DockerOverview> {
  return overviewCache.getOrSet("nas-overview", loadDockerOverview);
}

export async function controlDockerContainer(
  containerId: string,
  action: DockerContainerAction,
): Promise<void> {
  const env = getEnv();
  if (!env.DOCKER_CONTROL_ENABLED) {
    throw new Error("Docker control is disabled.");
  }
  // Fail closed: the read proxy and the write proxy must both identify as
  // the explicitly configured NAS engine before any mutating Docker request.
  const expected = env.DOCKER_EXPECTED_HOSTNAME?.trim().toLowerCase();
  if (!expected) throw new Error("Docker expected hostname is not configured.");
  const [readHost, writeHost] = await Promise.all([
    dockerGet("info", dockerInfoSchema),
    dockerControlInfo(),
  ]);
  if (
    readHost.Name.trim().toLowerCase() !== expected ||
    writeHost.Name.trim().toLowerCase() !== expected
  ) {
    throw new Error("Docker engine identity mismatch.");
  }

  const containers = await dockerGet(
    "containers/json?all=1",
    z.array(dockerContainerSchema),
  );
  const target = containers.find((container) => container.Id.startsWith(containerId));
  if (!target) throw new Error("Docker container not found.");

  const inspect = await dockerGet(
    `containers/${encodeURIComponent(target.Id)}/json`,
    dockerInspectSchema,
  );
  if (isProtectedVestyHubContainer(inspect.Config.Labels, target.Names)) {
    throw new Error("Protected VestyHub container.");
  }

  await dockerPost(dockerActionPath(target.Id, action));
  overviewCache.invalidate("nas-overview");
  inspectCache.invalidate(target.Id);
  statsCache.invalidate(target.Id);
}
