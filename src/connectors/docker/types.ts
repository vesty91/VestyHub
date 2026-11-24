export type DockerContainerState =
  | "running"
  | "exited"
  | "paused"
  | "restarting"
  | "created"
  | "dead"
  | "removing"
  | "unknown";

export type DockerHealthStatus =
  "healthy" | "unhealthy" | "starting" | "none" | "unknown";

export interface DockerPort {
  ip?: string;
  privatePort: number;
  publicPort?: number;
  protocol: string;
}

export interface DockerContainerMetrics {
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: DockerContainerState;
  health: DockerHealthStatus;
  status: string;
  createdAt: string;
  startedAt?: string;
  uptimeSeconds?: number;
  restartCount: number;
  ports: DockerPort[];
  composeProject?: string;
  composeService?: string;
  serviceUrl?: string;
  metrics?: DockerContainerMetrics;
  metricsAvailable: boolean;
  warning?: string;
}

export interface DockerEngineSummary {
  name: string;
  source: "NAS Synology";
  version: string;
  apiVersion: string;
  os: string;
  arch: string;
  operatingSystem?: string;
  cpus: number;
  memoryBytes: number;
  images: number;
}

export interface DockerOverview {
  /** False means intentionally absent from the environment, not an outage. */
  configured?: boolean;
  available: boolean;
  partial: boolean;
  fetchedAt: string;
  engine?: DockerEngineSummary;
  counters: {
    total: number;
    running: number;
    paused: number;
    stopped: number;
    unhealthy: number;
  };
  containers: DockerContainer[];
  warnings: string[];
  error?: string;
}
