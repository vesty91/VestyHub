import type { LocalResources } from "./metrics";

export const RESOURCE_HISTORY_WINDOW_MS = 5 * 60_000;
const MAX_HISTORY_POINTS = 64;

export interface ResourceHistoryPoint {
  sampledAt: string;
  cpu: number;
  memory: number;
}

function isValidPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/**
 * Keep only verified, increasing samples in a five-minute in-memory window.
 * Duplicate cached server samples must not distort the chart or chart density.
 * No browser storage, database, timer or network operation occurs here.
 */
export function appendResourceHistory(
  previous: readonly ResourceHistoryPoint[],
  resource: Pick<LocalResources, "sampledAt" | "cpu" | "memory">,
): ResourceHistoryPoint[] {
  const timestamp = Date.parse(resource.sampledAt);
  const cpu = resource.cpu?.usagePercent;
  const memory = resource.memory?.usagePercent;

  if (
    !Number.isFinite(timestamp) ||
    !isValidPercentage(cpu) ||
    !isValidPercentage(memory)
  ) {
    return previous as ResourceHistoryPoint[];
  }

  const last = previous.at(-1);
  if (last && timestamp <= Date.parse(last.sampledAt)) {
    return previous as ResourceHistoryPoint[];
  }

  const cutoff = timestamp - RESOURCE_HISTORY_WINDOW_MS;
  return [
    ...previous.filter((item) => Date.parse(item.sampledAt) >= cutoff),
    { sampledAt: resource.sampledAt, cpu, memory },
  ].slice(-MAX_HISTORY_POINTS);
}
