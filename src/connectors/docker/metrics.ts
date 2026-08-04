interface CpuStatsLike {
  cpu_usage?: {
    total_usage?: number;
    percpu_usage?: number[];
  };
  system_cpu_usage?: number;
  online_cpus?: number;
}

interface MemoryStatsLike {
  usage?: number;
  limit?: number;
  stats?: {
    inactive_file?: number;
    total_inactive_file?: number;
  };
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateCpuPercent(
  cpuStats: CpuStatsLike | undefined,
  preCpuStats: CpuStatsLike | undefined,
): number {
  const currentTotal = cpuStats?.cpu_usage?.total_usage ?? 0;
  const previousTotal = preCpuStats?.cpu_usage?.total_usage ?? 0;
  const currentSystem = cpuStats?.system_cpu_usage ?? 0;
  const previousSystem = preCpuStats?.system_cpu_usage ?? 0;
  const cpuDelta = currentTotal - previousTotal;
  const systemDelta = currentSystem - previousSystem;
  const onlineCpus =
    cpuStats?.online_cpus ?? cpuStats?.cpu_usage?.percpu_usage?.length ?? 1;

  if (cpuDelta <= 0 || systemDelta <= 0 || onlineCpus <= 0) return 0;
  return finiteNonNegative((cpuDelta / systemDelta) * onlineCpus * 100);
}

export function calculateMemoryMetrics(memoryStats: MemoryStatsLike | undefined) {
  const usage = finiteNonNegative(memoryStats?.usage ?? 0);
  const inactive = finiteNonNegative(
    memoryStats?.stats?.inactive_file ??
      memoryStats?.stats?.total_inactive_file ??
      0,
  );
  const memoryUsageBytes = Math.max(0, usage - inactive);
  const memoryLimitBytes = finiteNonNegative(memoryStats?.limit ?? 0);
  const memoryPercent =
    memoryLimitBytes > 0
      ? finiteNonNegative((memoryUsageBytes / memoryLimitBytes) * 100)
      : 0;

  return { memoryUsageBytes, memoryLimitBytes, memoryPercent };
}
