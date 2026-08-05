import { z } from "zod";

import { getEnv } from "@/lib/env";
import { assertServerOnly } from "@/lib/security/assert-server";

import { SynologyConnectorError, mapDsmErrorCode } from "./errors";
import { synologyPostJson } from "./http";
import {
  normalizeSynologyStorage,
  normalizeSynologySystem,
  normalizeSynologyUtilization,
} from "./normalize";
import type {
  NasDisk,
  NasStoragePool,
  NasSystemInfo,
  NasUtilization,
  NasVolume,
  SynologyApiCapability,
  SynologyWarning,
} from "./types";

assertServerOnly("connectors/synology/client");

const DISCOVERY_APIS = [
  "SYNO.API.Auth",
  "SYNO.Core.System",
  "SYNO.Core.System.Info",
  "SYNO.Core.System.Utilization",
  "SYNO.Core.System.Network",
  "SYNO.Storage.CGI.Storage",
  "SYNO.Core.Storage.Volume",
  "SYNO.Core.Storage.Pool",
  "SYNO.Core.Storage.Disk",
  "SYNO.Core.Storage.HddMan",
] as const;

const apiInfoSchema = z.object({
  path: z.string().min(1).max(256),
  minVersion: z.coerce.number().int().min(1).max(100),
  maxVersion: z.coerce.number().int().min(1).max(100),
  requestFormat: z.string().optional(),
});

const envelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.coerce.number().int(),
      errors: z.unknown().optional(),
    })
    .optional(),
});

const loginDataSchema = z.object({
  sid: z.string().min(1),
  synotoken: z.string().optional(),
});

interface SynologySession {
  sid: string;
  synoToken?: string;
  auth: SynologyApiCapability;
}

interface ReadPayload {
  api: string;
  method: string;
  data: unknown;
}

export interface SynologyDsmSnapshot {
  system: NasSystemInfo | null;
  utilization: NasUtilization | null;
  volumes: NasVolume[];
  storagePools: NasStoragePool[];
  disks: NasDisk[];
  capabilities: SynologyApiCapability[];
  warnings: SynologyWarning[];
}

function requestOptions(path: string, params: URLSearchParams) {
  const env = getEnv();
  return {
    baseUrl: env.SYNOLOGY_BASE_URL ?? "",
    path,
    params,
    timeoutMs: env.SYNOLOGY_TIMEOUT_MS,
    verifyTls: env.SYNOLOGY_VERIFY_TLS,
    caCertPath: env.SYNOLOGY_CA_CERT_PATH || undefined,
  };
}

function parseEnvelope(payload: unknown): unknown {
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SynologyConnectorError(
      "INVALID_RESPONSE",
      "DSM returned an invalid response envelope.",
      undefined,
      { cause: parsed.error },
    );
  }

  if (!parsed.data.success) {
    const dsmCode = parsed.data.error?.code ?? 0;
    throw new SynologyConnectorError(
      mapDsmErrorCode(dsmCode),
      `DSM API request failed with code ${dsmCode}.`,
      dsmCode,
    );
  }

  return parsed.data.data;
}

async function postApi(
  capability: SynologyApiCapability,
  method: string,
  params: Record<string, string> = {},
  session?: SynologySession,
): Promise<unknown> {
  const body = new URLSearchParams({
    api: capability.api,
    version: String(capability.maxVersion),
    method,
    ...params,
  });
  if (session) {
    body.set("_sid", session.sid);
    if (session.synoToken) body.set("SynoToken", session.synoToken);
  }
  return parseEnvelope(await synologyPostJson(requestOptions(capability.path, body)));
}

export async function discoverSynologyCapabilities(): Promise<SynologyApiCapability[]> {
  const body = new URLSearchParams({
    api: "SYNO.API.Info",
    version: "1",
    method: "query",
    query: DISCOVERY_APIS.join(","),
  });
  const data = parseEnvelope(await synologyPostJson(requestOptions("entry.cgi", body)));
  const record = z.record(z.string(), apiInfoSchema).safeParse(data);
  if (!record.success) {
    throw new SynologyConnectorError(
      "INVALID_RESPONSE",
      "DSM returned invalid API discovery data.",
      undefined,
      { cause: record.error },
    );
  }

  return Object.entries(record.data)
    .filter(([api]) => DISCOVERY_APIS.includes(api as (typeof DISCOVERY_APIS)[number]))
    .map(([api, info]) => ({
      api,
      path: info.path,
      minVersion: info.minVersion,
      maxVersion: info.maxVersion,
    }))
    .sort((left, right) => left.api.localeCompare(right.api));
}

async function login(capabilities: SynologyApiCapability[]): Promise<SynologySession> {
  const env = getEnv();
  const discovered = capabilities.find(
    (capability) => capability.api === "SYNO.API.Auth",
  );
  const auth: SynologyApiCapability = discovered
    ? {
        ...discovered,
        maxVersion: Math.max(discovered.minVersion, Math.min(discovered.maxVersion, 6)),
      }
    : { api: "SYNO.API.Auth", path: "entry.cgi", minVersion: 3, maxVersion: 6 };

  const params: Record<string, string> = {
    account: env.SYNOLOGY_USERNAME ?? "",
    passwd: env.SYNOLOGY_PASSWORD ?? "",
    session: "VestyHub",
    format: "sid",
  };
  if (auth.maxVersion >= 6) params.enable_syno_token = "yes";

  const data = loginDataSchema.safeParse(await postApi(auth, "login", params));
  if (!data.success) {
    throw new SynologyConnectorError(
      "INVALID_RESPONSE",
      "DSM login response did not contain a session identifier.",
      undefined,
      { cause: data.error },
    );
  }

  return { sid: data.data.sid, synoToken: data.data.synotoken, auth };
}

async function logout(session: SynologySession): Promise<void> {
  try {
    await postApi(session.auth, "logout", { session: "VestyHub" }, session);
  } catch {
    // Best effort: collection results must not be discarded when logout fails.
  }
}

function capabilityMap(capabilities: SynologyApiCapability[]) {
  return new Map(capabilities.map((capability) => [capability.api, capability]));
}

async function readFirstSupported(
  map: Map<string, SynologyApiCapability>,
  session: SynologySession,
  candidates: Array<{ api: string; methods: string[] }>,
  warnings: SynologyWarning[],
): Promise<ReadPayload | null> {
  for (const candidate of candidates) {
    const capability = map.get(candidate.api);
    if (!capability) continue;

    for (const method of candidate.methods) {
      try {
        return {
          api: candidate.api,
          method,
          data: await postApi(capability, method, {}, session),
        };
      } catch (error) {
        if (!(error instanceof SynologyConnectorError)) throw error;
        if (error.code === "SESSION_EXPIRED" || error.code === "AUTH_FAILED") throw error;
        if (error.code === "TWO_FACTOR_REQUIRED") throw error;

        if (error.code === "PERMISSION_DENIED") {
          warnings.push({
            code: error.code,
            api: candidate.api,
            message: `Le compte DSM ne peut pas lire ${candidate.api}.`,
          });
          break;
        }

        if (error.code !== "API_UNAVAILABLE") {
          warnings.push({
            code: error.code,
            api: candidate.api,
            message: `La lecture de ${candidate.api} a échoué.`,
          });
          break;
        }
      }
    }
  }
  return null;
}

async function readAllSupported(
  map: Map<string, SynologyApiCapability>,
  session: SynologySession,
  candidates: Array<{ api: string; methods: string[] }>,
  warnings: SynologyWarning[],
): Promise<ReadPayload[]> {
  const results: ReadPayload[] = [];
  for (const candidate of candidates) {
    const result = await readFirstSupported(map, session, [candidate], warnings);
    if (result) results.push(result);
  }
  return results;
}

export async function collectSynologyDsmSnapshot(): Promise<SynologyDsmSnapshot> {
  const capabilities = await discoverSynologyCapabilities();
  const map = capabilityMap(capabilities);
  const warnings: SynologyWarning[] = [];
  const session = await login(capabilities);

  try {
    const systemPayload = await readFirstSupported(
      map,
      session,
      [
        { api: "SYNO.Core.System", methods: ["info", "get"] },
        { api: "SYNO.Core.System.Info", methods: ["get", "info"] },
      ],
      warnings,
    );
    const utilizationPayloads = await readAllSupported(
      map,
      session,
      [
        { api: "SYNO.Core.System.Utilization", methods: ["get"] },
        { api: "SYNO.Core.System.Network", methods: ["get"] },
      ],
      warnings,
    );
    const storagePayloads = await readAllSupported(
      map,
      session,
      [
        {
          api: "SYNO.Storage.CGI.Storage",
          methods: ["load_info", "getinfo", "get_storage"],
        },
        { api: "SYNO.Core.Storage.Volume", methods: ["list", "get"] },
        { api: "SYNO.Core.Storage.Pool", methods: ["list", "get"] },
        { api: "SYNO.Core.Storage.Disk", methods: ["list", "get"] },
        { api: "SYNO.Core.Storage.HddMan", methods: ["get", "list"] },
      ],
      warnings,
    );

    const storage = normalizeSynologyStorage(
      storagePayloads.map((payload) => payload.data),
    );
    const system = normalizeSynologySystem([
      ...(systemPayload ? [systemPayload.data] : []),
      ...storagePayloads.map((payload) => payload.data),
    ]);
    const utilization = normalizeSynologyUtilization(
      utilizationPayloads.map((payload) => payload.data),
    );

    if (!system) {
      warnings.push({
        code: "PARTIAL_DATA",
        message: "DSM n’a retourné aucune information système exploitable.",
      });
    }
    if (!utilization) {
      warnings.push({
        code: "PARTIAL_DATA",
        message: "DSM n’a retourné aucune métrique d’utilisation exploitable.",
      });
    }
    if (
      storage.volumes.length === 0 &&
      storage.storagePools.length === 0 &&
      storage.disks.length === 0
    ) {
      warnings.push({
        code: "PARTIAL_DATA",
        message: "DSM n’a retourné aucune donnée de stockage exploitable.",
      });
    }

    return {
      system,
      utilization,
      ...storage,
      capabilities,
      warnings,
    };
  } finally {
    await logout(session);
  }
}
