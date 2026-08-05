import { z } from "zod";

import { MONITORING_RANGES, type MonitoringRange } from "./types";

export const monitoringRangeSchema = z.enum(MONITORING_RANGES);

interface MonitoringRangeConfig {
  durationSeconds: number;
  stepSeconds: number;
}

const RANGE_CONFIG: Record<MonitoringRange, MonitoringRangeConfig> = {
  "1h": { durationSeconds: 60 * 60, stepSeconds: 15 },
  "6h": { durationSeconds: 6 * 60 * 60, stepSeconds: 60 },
  "24h": { durationSeconds: 24 * 60 * 60, stepSeconds: 5 * 60 },
  "7d": { durationSeconds: 7 * 24 * 60 * 60, stepSeconds: 30 * 60 },
};

export function parseMonitoringRange(value: unknown): MonitoringRange {
  return monitoringRangeSchema.catch("1h").parse(value);
}

export function getMonitoringRangeWindow(
  range: MonitoringRange,
  nowMs = Date.now(),
): { startSeconds: number; endSeconds: number; stepSeconds: number } {
  const config = RANGE_CONFIG[range];
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const endSeconds = Math.floor(safeNowMs / 1000);

  return {
    startSeconds: endSeconds - config.durationSeconds,
    endSeconds,
    stepSeconds: config.stepSeconds,
  };
}
