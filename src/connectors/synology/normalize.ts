import type {
  NasDisk,
  NasStoragePool,
  NasSystemInfo,
  NasUtilization,
  NasVolume,
} from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function collectRecords(root: unknown, maxDepth = 5, maxNodes = 5_000): UnknownRecord[] {
  const records: UnknownRecord[] = [];
  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  let visited = 0;

  while (queue.length > 0 && visited < maxNodes) {
    const current = queue.shift();
    if (!current) break;
    visited += 1;

    if (Array.isArray(current.value)) {
      if (current.depth < maxDepth) {
        for (const item of current.value) {
          queue.push({ value: item, depth: current.depth + 1 });
        }
      }
      continue;
    }

    if (!isRecord(current.value)) continue;
    records.push(current.value);
    if (current.depth < maxDepth) {
      for (const value of Object.values(current.value)) {
        if (Array.isArray(value) || isRecord(value)) {
          queue.push({ value, depth: current.depth + 1 });
        }
      }
    }
  }

  return records;
}

function findValue(root: unknown, keys: readonly string[]): unknown {
  for (const record of collectRecords(root)) {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key];
    }
  }
  return undefined;
}

function findString(root: unknown, keys: readonly string[]): string | undefined {
  return toNonEmptyString(findValue(root, keys));
}

function findNumber(root: unknown, keys: readonly string[]): number | undefined {
  return toFiniteNumber(findValue(root, keys));
}

function findArrays(root: unknown, keys: readonly string[]): unknown[][] {
  const arrays: unknown[][] = [];
  for (const record of collectRecords(root)) {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) arrays.push(value);
    }
  }
  if (Array.isArray(root)) arrays.push(root);
  return arrays;
}

function clampPercent(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Math.min(100, Math.max(0, value));
}

function deriveStorageValues(root: unknown): {
  totalBytes?: number;
  usedBytes?: number;
  freeBytes?: number;
  usagePercent?: number;
} {
  const totalBytes = findNumber(root, [
    "total_size",
    "size_total",
    "total",
    "capacity",
    "size",
  ]);
  let usedBytes = findNumber(root, ["used_size", "size_used", "used"]);
  let freeBytes = findNumber(root, [
    "free_size",
    "size_free",
    "available_size",
    "avail_size",
    "free",
  ]);
  let usagePercent = clampPercent(
    findNumber(root, ["usage_percent", "used_percent", "percent", "usage"]),
  );

  if (totalBytes !== undefined && freeBytes !== undefined && usedBytes === undefined) {
    usedBytes = Math.max(0, totalBytes - freeBytes);
  }
  if (totalBytes !== undefined && usedBytes !== undefined && freeBytes === undefined) {
    freeBytes = Math.max(0, totalBytes - usedBytes);
  }
  if (usagePercent === undefined && totalBytes && usedBytes !== undefined) {
    usagePercent = clampPercent((usedBytes / totalBytes) * 100);
  }

  return { totalBytes, usedBytes, freeBytes, usagePercent };
}

export function normalizeSynologySystem(payloads: unknown[]): NasSystemInfo | null {
  const root = payloads;
  const system: NasSystemInfo = {
    hostname: findString(root, ["hostname", "server_name", "serverName"]),
    model: findString(root, ["model", "model_name", "modelName"]),
    serial: findString(root, ["serial", "serial_number", "serialNumber"]),
    dsmVersion: findString(root, [
      "firmware_ver",
      "version_string",
      "dsm_version",
      "version",
    ]),
    architecture: findString(root, ["arch", "architecture", "cpu_arch"]),
    uptimeSeconds: findNumber(root, ["uptime", "up_time", "uptime_seconds"]),
    temperatureCelsius: findNumber(root, [
      "temperature",
      "system_temp",
      "temp",
    ]),
    memoryBytes: findNumber(root, ["ram_size", "memory_size", "memory_total"]),
  };

  return Object.values(system).some((value) => value !== undefined) ? system : null;
}

export function normalizeSynologyUtilization(payloads: unknown[]): NasUtilization | null {
  const root = payloads;
  const cpuDirect = findNumber(root, ["total_load", "cpu_usage", "cpu_percent"]);
  const user = findNumber(root, ["user_load", "user"]);
  const systemLoad = findNumber(root, ["system_load", "system"]);
  const other = findNumber(root, ["other_load", "other"]);
  const cpuPercent = clampPercent(
    cpuDirect ??
      (user !== undefined || systemLoad !== undefined || other !== undefined
        ? (user ?? 0) + (systemLoad ?? 0) + (other ?? 0)
        : undefined),
  );

  const memoryPercent = clampPercent(
    findNumber(root, ["real_usage", "memory_usage", "memory_percent"]),
  );
  const networkReceiveBytesPerSecond = findNumber(root, [
    "rx",
    "receive",
    "receive_bytes",
    "network_receive",
  ]);
  const networkTransmitBytesPerSecond = findNumber(root, [
    "tx",
    "transmit",
    "transmit_bytes",
    "network_transmit",
  ]);

  const utilization: NasUtilization = {
    cpuPercent,
    memoryPercent,
    networkReceiveBytesPerSecond,
    networkTransmitBytesPerSecond,
  };
  return Object.values(utilization).some((value) => value !== undefined)
    ? utilization
    : null;
}

function normalizeVolume(item: unknown, index: number): NasVolume | null {
  if (!isRecord(item)) return null;
  const id =
    findString(item, ["volume_id", "volumeId", "id", "uuid"]) ?? `volume-${index + 1}`;
  const name =
    findString(item, ["display_name", "volume_name", "volumeName", "name"]) ?? id;
  return {
    id,
    name,
    status: findString(item, ["status", "status_name", "state"]),
    filesystem: findString(item, ["fs_type", "filesystem", "file_system"]),
    ...deriveStorageValues(item),
  };
}

function normalizePool(item: unknown, index: number): NasStoragePool | null {
  if (!isRecord(item)) return null;
  const id =
    findString(item, ["pool_id", "storage_pool_id", "id", "uuid"]) ??
    `pool-${index + 1}`;
  const name =
    findString(item, ["display_name", "pool_name", "storage_pool_name", "name"]) ?? id;
  return {
    id,
    name,
    status: findString(item, ["status", "status_name", "state"]),
    raidType: findString(item, ["raid_type", "raidType", "raid"]),
    ...deriveStorageValues(item),
  };
}

function normalizeDisk(item: unknown, index: number): NasDisk | null {
  if (!isRecord(item)) return null;
  const id =
    findString(item, ["disk_id", "diskId", "id", "device", "dev_name"]) ??
    `disk-${index + 1}`;
  const name = findString(item, ["name", "display_name", "device", "dev_name"]) ?? id;
  return {
    id,
    name,
    model: findString(item, ["model", "model_name"]),
    serial: findString(item, ["serial", "serial_number"]),
    status: findString(item, ["status", "status_name", "state"]),
    smartStatus: findString(item, ["smart_status", "smartStatus", "health"]),
    temperatureCelsius: findNumber(item, ["temperature", "temp"]),
    sizeBytes: findNumber(item, ["total_size", "size_total", "size", "capacity"]),
    type: findString(item, ["disk_type", "type", "media_type"]),
  };
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const result = new Map<string, T>();
  for (const item of items) {
    if (!result.has(item.id)) result.set(item.id, item);
  }
  return [...result.values()];
}

export function normalizeSynologyStorage(payloads: unknown[]): {
  volumes: NasVolume[];
  storagePools: NasStoragePool[];
  disks: NasDisk[];
} {
  const volumes = findArrays(payloads, [
    "volumes",
    "volume_info",
    "volume_infos",
    "volumeList",
  ]).flatMap((items) => items.map(normalizeVolume).filter((item): item is NasVolume => !!item));

  const storagePools = findArrays(payloads, [
    "storagePools",
    "storage_pools",
    "pools",
    "pool_info",
    "pool_infos",
  ]).flatMap((items) =>
    items.map(normalizePool).filter((item): item is NasStoragePool => !!item),
  );

  const disks = findArrays(payloads, [
    "disks",
    "disk_info",
    "disk_infos",
    "diskList",
  ]).flatMap((items) => items.map(normalizeDisk).filter((item): item is NasDisk => !!item));

  return {
    volumes: deduplicateById(volumes),
    storagePools: deduplicateById(storagePools),
    disks: deduplicateById(disks),
  };
}
