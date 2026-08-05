import { ShortTtlCache } from "@/connectors/core/cache";
import { collectSynologyDsmSnapshot } from "@/connectors/synology/client";
import {
  normalizeSynologyError,
  publicSynologyErrorMessage,
} from "@/connectors/synology/errors";
import type {
  NasOverview,
  NasUtilization,
  SynologyWarning,
} from "@/connectors/synology/types";
import { getEnv } from "@/lib/env";
import { getMonitoringOverview } from "@/lib/monitoring/service";
import { assertServerOnly } from "@/lib/security/assert-server";

assertServerOnly("lib/nas/service");

const nasCache = new ShortTtlCache<NasOverview>({ ttlMs: 15_000, maxEntries: 3 });

function endpointHost(baseUrl: string): string | undefined {
  if (!baseUrl) return undefined;
  try {
    return new URL(baseUrl).host;
  } catch {
    return undefined;
  }
}

async function prometheusUtilization(): Promise<NasUtilization | null> {
  const monitoring = await getMonitoringOverview("1h");
  const summary = monitoring.summary;
  const utilization: NasUtilization = {
    cpuPercent: summary.cpuPercent,
    memoryPercent: summary.memoryPercent,
    networkReceiveBytesPerSecond: summary.networkReceiveBytesPerSecond,
    networkTransmitBytesPerSecond: summary.networkTransmitBytesPerSecond,
  };
  return Object.values(utilization).some((value) => value !== undefined)
    ? utilization
    : null;
}

function disabledOverview(): NasOverview {
  const env = getEnv();
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    status: {
      enabled: false,
      configured: false,
      available: false,
      mode: env.SYNOLOGY_MODE,
      checkedAt: generatedAt,
      tlsVerified: env.SYNOLOGY_VERIFY_TLS,
      errorCode: "DISABLED",
    },
    system: null,
    utilization: null,
    volumes: [],
    storagePools: [],
    disks: [],
    capabilities: [],
    warnings: [
      {
        code: "DISABLED",
        message: publicSynologyErrorMessage("DISABLED"),
      },
    ],
  };
}

async function loadNasOverview(): Promise<NasOverview> {
  const env = getEnv();
  if (!env.SYNOLOGY_ENABLED) return disabledOverview();

  const generatedAt = new Date().toISOString();
  const startedAt = performance.now();
  const warnings: SynologyWarning[] = [];
  if (!env.SYNOLOGY_VERIFY_TLS) {
    warnings.push({
      code: "TLS_VERIFICATION_DISABLED",
      message: "La vérification du certificat TLS DSM est désactivée.",
    });
  }

  if (env.SYNOLOGY_MODE === "prometheus") {
    try {
      const utilization = await prometheusUtilization();
      if (!utilization) {
        warnings.push({
          code: "PARTIAL_DATA",
          message: "Prometheus ne retourne aucune métrique NAS exploitable.",
        });
      }
      warnings.push({
        code: "PARTIAL_DATA",
        message:
          "Le mode Prometheus ne fournit pas l’identité DSM, les volumes ou les disques.",
      });
      return {
        generatedAt,
        status: {
          enabled: true,
          configured: Boolean(env.PROMETHEUS_URL),
          available: Boolean(utilization),
          mode: env.SYNOLOGY_MODE,
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          checkedAt: generatedAt,
          tlsVerified: true,
          ...(utilization ? {} : { errorCode: "API_UNAVAILABLE" as const }),
        },
        system: null,
        utilization,
        volumes: [],
        storagePools: [],
        disks: [],
        capabilities: [],
        warnings,
      };
    } catch (error) {
      const normalized = normalizeSynologyError(error);
      return {
        generatedAt,
        status: {
          enabled: true,
          configured: Boolean(env.PROMETHEUS_URL),
          available: false,
          mode: env.SYNOLOGY_MODE,
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          checkedAt: generatedAt,
          tlsVerified: true,
          errorCode: normalized.code,
        },
        system: null,
        utilization: null,
        volumes: [],
        storagePools: [],
        disks: [],
        capabilities: [],
        warnings: [
          ...warnings,
          { code: normalized.code, message: publicSynologyErrorMessage(normalized.code) },
        ],
      };
    }
  }

  try {
    const snapshot = await collectSynologyDsmSnapshot();
    let utilization = snapshot.utilization;
    if (!utilization && env.SYNOLOGY_MODE === "hybrid" && env.PROMETHEUS_URL) {
      try {
        utilization = await prometheusUtilization();
        if (utilization) {
          warnings.push({
            code: "PARTIAL_DATA",
            message: "Les métriques d’utilisation sont complétées par Prometheus.",
          });
        }
      } catch {
        warnings.push({
          code: "PARTIAL_DATA",
          message: "Prometheus n’a pas pu compléter les métriques DSM.",
        });
      }
    }

    return {
      generatedAt,
      status: {
        enabled: true,
        configured: true,
        available: true,
        mode: env.SYNOLOGY_MODE,
        endpointHost: endpointHost(env.SYNOLOGY_BASE_URL),
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        checkedAt: generatedAt,
        tlsVerified: env.SYNOLOGY_VERIFY_TLS,
      },
      system: snapshot.system,
      utilization,
      volumes: snapshot.volumes,
      storagePools: snapshot.storagePools,
      disks: snapshot.disks,
      capabilities: snapshot.capabilities,
      warnings: [...warnings, ...snapshot.warnings],
    };
  } catch (error) {
    const normalized = normalizeSynologyError(error);
    return {
      generatedAt,
      status: {
        enabled: true,
        configured: true,
        available: false,
        mode: env.SYNOLOGY_MODE,
        endpointHost: endpointHost(env.SYNOLOGY_BASE_URL),
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        checkedAt: generatedAt,
        tlsVerified: env.SYNOLOGY_VERIFY_TLS,
        errorCode: normalized.code,
      },
      system: null,
      utilization: null,
      volumes: [],
      storagePools: [],
      disks: [],
      capabilities: [],
      warnings: [
        ...warnings,
        { code: normalized.code, message: publicSynologyErrorMessage(normalized.code) },
      ],
    };
  }
}

export async function getNasOverview(): Promise<NasOverview> {
  return nasCache.getOrSet("overview", loadNasOverview);
}
