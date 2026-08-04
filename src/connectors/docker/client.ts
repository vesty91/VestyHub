import { z } from "zod";

import { ShortTtlCache } from "@/connectors/core/cache";
import { fetchWithTimeout } from "@/connectors/core/http";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging/logger";

import { calculateCpuPercent, calculateMemoryMetrics } from "./metrics";
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

  if (container.State === "running") {
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
  const startedAt = inspect?.State.StartedAt;
  const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  const uptimeSeconds = Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
    : undefined;
  const cpuPercent = calculateCpuPercent(stats?.cpu_stats, stats?.precpu_stats);
  const memory = calculateMemoryMetrics(stats?.memory_stats);
  const metricsAvailable = Boolean(stats);

  return {
    id: id.slice(0, 12),
    name: container.Names[0]?.replace(/^\//, "") || id.slice(0, 12),
    image: container.Image,
    state: normalizeState(container.State),
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
    metrics: metricsAvailable
      ? { cpuPercent, ...memory }
      : undefined,
    metricsAvailable,
    warning: warnings.length ? warnings.join(" · ") : undefined,
  };
}

async function loadDockerOverview(): Promise<DockerOverview> {
  const fetchedAt = new Date().toISOString();
  try {
    const [version, info, rawContainers] = await Promise.all([
      dockerGet("version", dockerVersionSchema),
      dockerGet("info", dockerInfoSchema),
      dockerGet("containers/json?all=1", z.array(dockerContainerSchema)),
    ]);

    const expected = getEnv().DOCKER_EXPECTED_HOSTNAME;
    if (expected && info.Name.toLowerCase() !== expected.toLowerCase()) {
      return {
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
        unhealthy: containers.filter((container) => container.health === "unhealthy").length,
      },
      containers,
      warnings,
    };
  } catch (error) {
    dockerLogger.warn("Unable to read NAS Docker overview.", { error });
    return {
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
