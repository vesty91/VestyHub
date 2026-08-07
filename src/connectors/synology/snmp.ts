import { z } from "zod";

import { ShortTtlCache } from "@/connectors/core/cache";
import { MonitoringConnectorError } from "@/connectors/monitoring/errors";
import { monitoringGetJson } from "@/connectors/monitoring/http";
import { getEnv } from "@/lib/env";
import { assertServerOnly } from "@/lib/security/assert-server";

import type { NasDisk, NasStoragePool, NasVolume } from "./types";

assertServerOnly("connectors/synology/snmp");

const sampleSchema = z.object({
  metric: z.record(z.string(), z.string()).default({}),
  value: z.tuple([z.union([z.number(), z.string()]), z.string()]),
});

const vectorResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    resultType: z.literal("vector"),
    result: z.array(sampleSchema).max(1_000),
  }),
});

const storageCache = new ShortTtlCache<SynologySnmpStorageSnapshot>({
  ttlMs: 15_000,
  maxEntries: 4,
});

const STORAGE_QUERY =
  '{__name__=~"^(diskStatus|diskHealthStatus|diskTemperature|diskName|diskModel|diskType|raidStatus|raidFreeSize|raidTotalSize)$",job="synology-snmp"}';

const diskStatusLabels: Record<number, string> = {
  1: "Normal",
  2: "Initialisé",
  3: "Non initialisé",
  4: "Partition système défaillante",
  5: "En panne",
  6: "Déconnecté",
};

const diskHealthLabels: Record<number, string> = {
  1: "Normal",
  2: "Avertissement",
  3: "Critique",
  4: "Défaillant",
};

const raidStatusLabels: Record<number, string> = {
  1: "Normal",
  2: "Réparation",
  3: "Migration",
  4: "Extension",
  5: "Suppression",
  6: "Création",
  7: "Synchronisation RAID",
  8: "Vérification de parité",
  9: "Assemblage RAID",
  10: "Annulation",
  11: "Dégradé",
  12: "En panne",
  13: "Scrubbing des données",
  14: "Déploiement RAID",
  15: "Retrait RAID",
  16: "Montage du cache",
  17: "Retrait du cache",
  18: "Extension SHR inachevée",
  19: "Conversion SHR vers pool",
  20: "Migration SHR-1 vers SHR-2",
  21: "État inconnu",
};

interface MetricSample {
  metric: Record<string, string>;
  value: [number | string, string];
}

interface DiskAccumulator {
  id: string;
  name: string;
  model?: string;
  type?: string;
  status?: string;
  smartStatus?: string;
  temperatureCelsius?: number;
}

interface RaidAccumulator {
  name: string;
  status?: string;
  totalBytes?: number;
  freeBytes?: number;
}

export interface SynologySnmpStorageSnapshot {
  volumes: NasVolume[];
  storagePools: NasStoragePool[];
  disks: NasDisk[];
}

function parseFinite(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function decodeHexLabel(value: string): string | undefined {
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(value)) return value || undefined;
  try {
    const hex = value.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < hex.length; index += 2) {
      bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
    }
    const decoded = new TextDecoder().decode(bytes).replace(/\0+$/g, "").trim();
    return decoded || value;
  } catch {
    return value;
  }
}

function sampleName(sample: MetricSample): string | undefined {
  return sample.metric.__name__;
}

function metricString(sample: MetricSample, key: string): string | undefined {
  const value = sample.metric[key];
  return value?.trim() || undefined;
}

function buildCapacity(totalBytes?: number, freeBytes?: number) {
  if (totalBytes === undefined || totalBytes <= 0) {
    return { totalBytes, freeBytes };
  }
  const normalizedFree = Math.min(totalBytes, Math.max(0, freeBytes ?? 0));
  const usedBytes = totalBytes - normalizedFree;
  return {
    totalBytes,
    freeBytes: normalizedFree,
    usedBytes,
    usagePercent: Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100)),
  };
}

function normalizeDiskSamples(samples: MetricSample[]): NasDisk[] {
  const disks = new Map<string, DiskAccumulator>();

  for (const sample of samples) {
    const metricName = sampleName(sample);
    if (!metricName?.startsWith("disk")) continue;

    const rawId = metricString(sample, "diskID") ?? metricString(sample, "diskName");
    if (!rawId) continue;
    const decodedName =
      decodeHexLabel(metricString(sample, "diskName") ?? "") ??
      decodeHexLabel(rawId) ??
      rawId;
    const key = rawId.toLowerCase();
    const disk = disks.get(key) ?? {
      id: `snmp-disk:${rawId}`,
      name: decodedName,
    };

    const value = parseFinite(sample.value[1]);
    if (metricName === "diskStatus" && value !== undefined) {
      disk.status = diskStatusLabels[value] ?? `État ${value}`;
    } else if (metricName === "diskHealthStatus" && value !== undefined) {
      disk.smartStatus = diskHealthLabels[value] ?? `Santé ${value}`;
    } else if (metricName === "diskTemperature" && value !== undefined) {
      disk.temperatureCelsius = value;
    }

    disk.name = decodeHexLabel(metricString(sample, "diskName") ?? "") ?? disk.name;
    disk.model = metricString(sample, "diskModel") ?? disk.model;
    disk.type = metricString(sample, "diskType") ?? disk.type;
    disks.set(key, disk);
  }

  return [...disks.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "fr", { numeric: true }),
  );
}

function normalizeRaidSamples(samples: MetricSample[]) {
  const items = new Map<string, RaidAccumulator>();

  for (const sample of samples) {
    const metricName = sampleName(sample);
    if (!metricName?.startsWith("raid")) continue;
    const name = metricString(sample, "raidName");
    if (!name) continue;

    const key = name.toLowerCase();
    const item = items.get(key) ?? { name };
    const value = parseFinite(sample.value[1]);

    if (metricName === "raidStatus" && value !== undefined) {
      item.status = raidStatusLabels[value] ?? `État ${value}`;
    } else if (metricName === "raidFreeSize" && value !== undefined) {
      item.freeBytes = value;
    } else if (metricName === "raidTotalSize" && value !== undefined) {
      item.totalBytes = value;
    }
    items.set(key, item);
  }

  const volumes: NasVolume[] = [];
  const storagePools: NasStoragePool[] = [];

  for (const item of items.values()) {
    const capacity = buildCapacity(item.totalBytes, item.freeBytes);
    if (/^volume(?:\s|$)/i.test(item.name)) {
      volumes.push({
        id: `snmp-volume:${item.name}`,
        name: item.name,
        status: item.status,
        ...capacity,
      });
    } else {
      storagePools.push({
        id: `snmp-pool:${item.name}`,
        name: item.name,
        status: item.status,
        ...capacity,
      });
    }
  }

  return {
    volumes: volumes.sort((left, right) =>
      left.name.localeCompare(right.name, "fr", { numeric: true }),
    ),
    storagePools: storagePools.sort((left, right) =>
      left.name.localeCompare(right.name, "fr", { numeric: true }),
    ),
  };
}

export function normalizeSynologySnmpStorage(
  payload: unknown,
): SynologySnmpStorageSnapshot {
  const parsed = vectorResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new MonitoringConnectorError(
      "prometheus",
      "INVALID_RESPONSE",
      "Prometheus returned invalid Synology SNMP metrics.",
      { cause: parsed.error },
    );
  }

  const samples = parsed.data.data.result;
  const raid = normalizeRaidSamples(samples);
  return {
    ...raid,
    disks: normalizeDiskSamples(samples),
  };
}

export async function collectSynologySnmpStorage(): Promise<SynologySnmpStorageSnapshot> {
  const env = getEnv();
  return storageCache.getOrSet("synology-snmp-storage", async () => {
    const searchParams = new URLSearchParams({ query: STORAGE_QUERY });
    const payload = await monitoringGetJson({
      source: "prometheus",
      connectorName: "Prometheus",
      baseUrl: env.PROMETHEUS_URL ?? "",
      path: "/api/v1/query",
      timeoutMs: env.PROMETHEUS_TIMEOUT_MS,
      searchParams,
    });
    return normalizeSynologySnmpStorage(payload);
  });
}
