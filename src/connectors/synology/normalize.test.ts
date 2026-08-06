// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  normalizeSynologyStorage,
  normalizeSynologySystem,
  normalizeSynologyUtilization,
} from "./normalize";

describe("Synology payload normalization", () => {
  it("extracts system identity from nested DSM responses", () => {
    expect(
      normalizeSynologySystem([
        {
          data: {
            hostname: "RestorPc",
            model: "DS920+",
            firmware_ver: "DSM 7.2.2",
            uptime: "86460",
            temperature: 43,
            ram_size: "4294967296",
          },
        },
      ]),
    ).toEqual({
      hostname: "RestorPc",
      model: "DS920+",
      serial: undefined,
      dsmVersion: "DSM 7.2.2",
      architecture: undefined,
      uptimeSeconds: 86460,
      temperatureCelsius: 43,
      memoryBytes: 4294967296,
    });
  });

  it("converts DSM ram_size expressed in MiB to bytes", () => {
    expect(
      normalizeSynologySystem([
        {
          data: {
            ram_size: 8192,
          },
        },
      ]),
    ).toEqual({
      hostname: undefined,
      model: undefined,
      serial: undefined,
      dsmVersion: undefined,
      architecture: undefined,
      uptimeSeconds: undefined,
      temperatureCelsius: undefined,
      memoryBytes: 8192 * 1024 * 1024,
    });
  });

  it("extracts CPU, memory and network utilization", () => {
    expect(
      normalizeSynologyUtilization([
        {
          cpu: { user_load: 8, system_load: 3, other_load: 1 },
          memory: { real_usage: 37.5 },
          network: [{ rx: 1024, tx: 2048 }],
        },
      ]),
    ).toEqual({
      cpuPercent: 12,
      memoryPercent: 37.5,
      networkReceiveBytesPerSecond: 1024,
      networkTransmitBytesPerSecond: 2048,
    });
  });

  it("normalizes volumes, storage pools and disks", () => {
    const normalized = normalizeSynologyStorage([
      {
        volumes: [
          {
            volume_id: "volume_1",
            display_name: "Volume 1",
            status: "normal",
            fs_type: "btrfs",
            size: { total: "1000", used: "250", free: "750" },
          },
        ],
        storagePools: [
          {
            pool_id: "pool_1",
            name: "Groupe 1",
            status: "normal",
            raid_type: "SHR",
            total_size: "1000",
            used_size: "250",
          },
        ],
        disks: [
          {
            disk_id: "disk_1",
            name: "Disque 1",
            model: "ST4000VN008",
            serial: "ABC123",
            status: "normal",
            smart_status: "healthy",
            temperature: 35,
            size: "4000",
          },
        ],
      },
    ]);

    expect(normalized.volumes[0]).toMatchObject({
      id: "volume_1",
      name: "Volume 1",
      filesystem: "btrfs",
      totalBytes: 1000,
      usedBytes: 250,
      freeBytes: 750,
      usagePercent: 25,
    });
    expect(normalized.storagePools[0]).toMatchObject({
      id: "pool_1",
      raidType: "SHR",
      usagePercent: 25,
    });
    expect(normalized.disks[0]).toMatchObject({
      id: "disk_1",
      model: "ST4000VN008",
      smartStatus: "healthy",
      temperatureCelsius: 35,
      sizeBytes: 4000,
    });
  });
});
