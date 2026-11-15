import { statfsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CpuTimes {
  idle: number;
  user: number;
  nice: number;
  sys: number;
  irq: number;
}

export interface LocalDiskMetric {
  drive: string;
  totalBytes: number;
  freeBytes: number;
  usedPercent: number;
}

export interface LocalResources {
  sampledAt: string;
  cpu: { usagePercent: number; logicalCores: number };
  memory: { totalBytes: number; usedBytes: number; usagePercent: number };
  disks: LocalDiskMetric[];
}

function percent(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.round(Math.min(100, Math.max(0, (used / total) * 100)) * 10) / 10;
}

export function calculateCpuUsage(
  before: readonly CpuTimes[],
  after: readonly CpuTimes[],
): number {
  if (before.length === 0 || before.length !== after.length) {
    return 0;
  }

  let idleDelta = 0;
  let totalDelta = 0;

  for (let index = 0; index < before.length; index += 1) {
    const first = before[index];
    const second = after[index];
    const idle = second.idle - first.idle;
    const total = (Object.keys(first) as (keyof CpuTimes)[]).reduce(
      (sum, key) => sum + second[key] - first[key],
      0,
    );
    if (idle >= 0 && total > 0) {
      idleDelta += idle;
      totalDelta += total;
    }
  }

  return percent(totalDelta - idleDelta, totalDelta);
}

export function calculateUsage(total: number, available: number): number {
  return percent(total - available, total);
}

function getDiskMetrics(): LocalDiskMetric[] {
  const applicationDrive = path.parse(process.cwd()).root;
  const systemDrive = process.env.SystemDrive || "C:";
  const roots = Array.from(new Set([systemDrive + "/", applicationDrive]));

  return roots.flatMap((root) => {
    try {
      const stats = statfsSync(root);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;
      if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0) {
        return [];
      }

      return [
        {
          drive: path.parse(root).root.slice(0, 2).toUpperCase(),
          totalBytes,
          freeBytes,
          usedPercent: calculateUsage(totalBytes, freeBytes),
        },
      ];
    } catch {
      // Missing/unmounted drives are not treated as a system failure.
      return [];
    }
  });
}

function cpuSnapshot(): CpuTimes[] {
  return os.cpus().map((cpu) => ({ ...cpu.times }));
}

let cached: { time: number; value: LocalResources } | null = null;
let pending: Promise<LocalResources> | null = null;

export async function getLocalResources(): Promise<LocalResources> {
  const now = Date.now();
  if (cached && now - cached.time < 5_000) {
    return cached.value;
  }
  if (pending) {
    return pending;
  }

  pending = (async () => {
    const before = cpuSnapshot();
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
    const after = cpuSnapshot();
    const totalBytes = os.totalmem();
    const available = os.freemem();

    const value: LocalResources = {
      sampledAt: new Date().toISOString(),
      cpu: { usagePercent: calculateCpuUsage(before, after), logicalCores: after.length },
      memory: {
        totalBytes,
        usedBytes: Math.max(0, totalBytes - available),
        usagePercent: calculateUsage(totalBytes, available),
      },
      disks: getDiskMetrics(),
    };
    cached = { time: Date.now(), value };
    return value;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}
