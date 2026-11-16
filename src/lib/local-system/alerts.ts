import type { LocalResources } from "./metrics";

/**
 * Local-only monitoring state. No notifications, server writes or actions on
 * processes are triggered by these alerts.
 */
export type ResourceThresholds = { cpu: number; memory: number };
export type ResourceKey = keyof ResourceThresholds;
export type AlertTrack = { active: boolean; highCount: number; normalCount: number };
export type ResourceAlertState = {
  lastSampledAt: string | null;
  cpu: AlertTrack;
  memory: AlertTrack;
};

export const RESOURCE_THRESHOLD_OPTIONS = [70, 75, 80, 85, 90, 95] as const;

export const DEFAULT_RESOURCE_THRESHOLDS: ResourceThresholds = {
  cpu: 90,
  memory: 85,
};

export function initialResourceAlertState(): ResourceAlertState {
  return {
    lastSampledAt: null,
    cpu: { active: false, highCount: 0, normalCount: 0 },
    memory: { active: false, highCount: 0, normalCount: 0 },
  };
}

function advanceTrack(
  previous: AlertTrack,
  usage: number,
  threshold: number,
): AlertTrack {
  // Ignore invalid samples rather than inventing an alert or recovery.
  if (
    !Number.isFinite(usage) ||
    usage < 0 ||
    usage > 100 ||
    !RESOURCE_THRESHOLD_OPTIONS.some((value) => value === threshold)
  ) {
    return previous;
  }

  if (!previous.active) {
    const highCount = usage >= threshold ? previous.highCount + 1 : 0;
    return {
      active: highCount >= 2,
      highCount: Math.min(2, highCount),
      normalCount: 0,
    };
  }

  // A 5 percentage point hysteresis avoids rapid alert blinking around
  // the configured threshold. Two valid recovery samples are required.
  const normalCount = usage <= threshold - 5 ? previous.normalCount + 1 : 0;
  return normalCount >= 2
    ? { active: false, highCount: 0, normalCount: 0 }
    : { active: true, highCount: 0, normalCount };
}

/**
 * At most one state transition for each unique and chronologically ordered
 * server sample. Manual refreshes may receive the same cached sample and must
 * not count as consecutive measurements.
 */
export function advanceResourceAlerts(
  previous: ResourceAlertState,
  sample: Pick<LocalResources, "sampledAt" | "cpu" | "memory">,
  thresholds: ResourceThresholds,
): ResourceAlertState {
  const nextTime = Date.parse(sample.sampledAt);
  const previousTime = previous.lastSampledAt ? Date.parse(previous.lastSampledAt) : NaN;

  if (
    !Number.isFinite(nextTime) ||
    (Number.isFinite(previousTime) && nextTime <= previousTime)
  ) {
    return previous;
  }

  return {
    lastSampledAt: sample.sampledAt,
    cpu: advanceTrack(previous.cpu, sample.cpu.usagePercent, thresholds.cpu),
    memory: advanceTrack(previous.memory, sample.memory.usagePercent, thresholds.memory),
  };
}
