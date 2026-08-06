import { readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";

import { SynologyConnectorError, normalizeSynologyError } from "./errors";

const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const caCache = new Map<string, Promise<Buffer>>();

export interface SynologyHttpOptions {
  baseUrl: string;
  path: string;
  params: URLSearchParams;
  timeoutMs: number;
  verifyTls: boolean;
  caCertPath?: string;
  maxResponseBytes?: number;
  headers?: Readonly<Record<string, string>>;
}

function validateBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch (error) {
    throw new SynologyConnectorError("INVALID_URL", "Invalid DSM base URL.", undefined, {
      cause: error,
    });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SynologyConnectorError(
      "INVALID_URL",
      "DSM base URL must use HTTP or HTTPS.",
    );
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new SynologyConnectorError(
      "INVALID_URL",
      "DSM base URL must not include credentials, query parameters or fragments.",
    );
  }

  return url;
}

function validateApiPath(path: string): string {
  const normalized = path
    .trim()
    .replace(/^\/+/, "")
    .replace(/^webapi\//, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.includes(":") ||
    normalized.includes("\\") ||
    !/^[A-Za-z0-9._/-]+\.cgi$/.test(normalized)
  ) {
    throw new SynologyConnectorError("INVALID_URL", "Invalid DSM API path.");
  }
  return normalized;
}

export function buildSynologyApiUrl(baseUrl: string, path: string): URL {
  const base = validateBaseUrl(baseUrl);
  const apiPath = validateApiPath(path);
  base.pathname = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  return new URL(`webapi/${apiPath}`, base);
}

async function loadCaCertificate(path: string): Promise<Buffer> {
  const cached = caCache.get(path);
  if (cached) return cached;

  const loading = readFile(path).catch((error) => {
    caCache.delete(path);
    throw new SynologyConnectorError(
      "TLS_ERROR",
      "Unable to read the configured DSM CA certificate.",
      undefined,
      { cause: error },
    );
  });
  caCache.set(path, loading);
  return loading;
}

export async function synologyPostJson({
  baseUrl,
  path,
  params,
  timeoutMs,
  verifyTls,
  caCertPath,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  headers,
}: SynologyHttpOptions): Promise<unknown> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 120_000) {
    throw new RangeError("timeoutMs must be between 250 and 120000.");
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1) {
    throw new RangeError("maxResponseBytes must be a positive integer.");
  }

  const url = buildSynologyApiUrl(baseUrl, path);
  const body = params.toString();
  const ca =
    url.protocol === "https:" && caCertPath
      ? await loadCaCertificate(caCertPath)
      : undefined;
  const transport = url.protocol === "https:" ? https : http;

  try {
    return await new Promise<unknown>((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method: "POST",
          headers: {
            ...headers,
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
            "Content-Length": Buffer.byteLength(body),
          },
          ...(url.protocol === "https:"
            ? {
                rejectUnauthorized: verifyTls,
                ...(ca ? { ca } : {}),
              }
            : {}),
        },
        (response) => {
          const statusCode = response.statusCode ?? 0;
          if (statusCode < 200 || statusCode >= 300) {
            response.resume();
            reject(
              new SynologyConnectorError(
                "HTTP_ERROR",
                `DSM returned HTTP ${statusCode}.`,
              ),
            );
            return;
          }

          const chunks: Buffer[] = [];
          let totalBytes = 0;
          response.on("data", (chunk: Buffer | string) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += buffer.length;
            if (totalBytes > maxResponseBytes) {
              response.destroy();
              request.destroy(
                new SynologyConnectorError(
                  "INVALID_RESPONSE",
                  "DSM response exceeded the maximum allowed size.",
                ),
              );
              return;
            }
            chunks.push(buffer);
          });
          response.on("end", () => {
            try {
              const text = Buffer.concat(chunks).toString("utf8");
              resolve(JSON.parse(text) as unknown);
            } catch (error) {
              reject(
                new SynologyConnectorError(
                  "INVALID_RESPONSE",
                  "DSM returned invalid JSON.",
                  undefined,
                  { cause: error },
                ),
              );
            }
          });
          response.on("error", reject);
        },
      );

      request.setTimeout(timeoutMs, () => {
        const error = new Error("Synology request timeout");
        error.name = "AbortError";
        request.destroy(error);
      });
      request.on("error", reject);
      request.end(body);
    });
  } catch (error) {
    throw normalizeSynologyError(error);
  }
}
