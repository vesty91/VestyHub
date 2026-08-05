// @vitest-environment node

import { describe, expect, it } from "vitest";

import { normalizeSynologySnmpStorage } from "./snmp";

function sample(name: string, labels: Record<string, string>, value: string) {
  return {
    metric: {
      __name__: name,
      device: "RestorPc",
      instance: "192.168.1.5",
      job: "synology-snmp",
      source: "synology-snmp",
      ...labels,
    },
    value: [1785940684.659, value],
  };
}

describe("Synology SNMP normalization", () => {
  it("normalizes the real DS920+ disk metrics", () => {
    const payload = {
      status: "success",
      data: {
        resultType: "vector",
        result: [
          sample("diskHealthStatus", { diskID: "0x4469736B2031" }, "1"),
          sample("diskStatus", { diskID: "0x4469736B2031" }, "1"),
          sample("diskTemperature", { diskID: "0x4469736B2031" }, "38"),
          sample("diskHealthStatus", { diskID: "0x4469736B2032" }, "2"),
          sample("diskStatus", { diskID: "0x4469736B2032" }, "1"),
          sample("diskTemperature", { diskID: "0x4469736B2032" }, "42"),
        ],
      },
    };

    const normalized = normalizeSynologySnmpStorage(payload);

    expect(normalized.disks).toEqual([
      {
        id: "snmp-disk:0x4469736B2031",
        name: "Disk 1",
        status: "Normal",
        smartStatus: "Normal",
        temperatureCelsius: 38,
      },
      {
        id: "snmp-disk:0x4469736B2032",
        name: "Disk 2",
        status: "Normal",
        smartStatus: "Avertissement",
        temperatureCelsius: 42,
      },
    ]);
  });

  it("separates volumes from storage pools and computes capacity", () => {
    const payload = {
      status: "success",
      data: {
        resultType: "vector",
        result: [
          sample("raidFreeSize", { raidName: "Storage Pool 1" }, "511705088"),
          sample("raidStatus", { raidName: "Storage Pool 1" }, "1"),
          sample("raidTotalSize", { raidName: "Storage Pool 1" }, "14976001507328"),
          sample("raidFreeSize", { raidName: "Volume 1" }, "7363491246080"),
          sample("raidStatus", { raidName: "Volume 1" }, "1"),
          sample("raidTotalSize", { raidName: "Volume 1" }, "14376458133504"),
        ],
      },
    };

    const normalized = normalizeSynologySnmpStorage(payload);

    expect(normalized.volumes).toHaveLength(1);
    expect(normalized.volumes[0]).toMatchObject({
      id: "snmp-volume:Volume 1",
      name: "Volume 1",
      status: "Normal",
      totalBytes: 14376458133504,
      freeBytes: 7363491246080,
      usedBytes: 7012966887424,
    });
    expect(normalized.volumes[0]?.usagePercent).toBeCloseTo(48.78, 2);

    expect(normalized.storagePools).toHaveLength(1);
    expect(normalized.storagePools[0]).toMatchObject({
      id: "snmp-pool:Storage Pool 1",
      name: "Storage Pool 1",
      status: "Normal",
      totalBytes: 14976001507328,
      freeBytes: 511705088,
      usedBytes: 14975489802240,
    });
    expect(normalized.storagePools[0]?.usagePercent).toBeCloseTo(100, 3);
  });

  it("rejects a malformed Prometheus response", () => {
    expect(() => normalizeSynologySnmpStorage({ status: "error" })).toThrow(
      "invalid Synology SNMP metrics",
    );
  });
});
