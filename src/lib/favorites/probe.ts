import { lookup } from "node:dns/promises";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

const REQUEST_TIMEOUT_MS = 3_000;
const DNS_TIMEOUT_MS = 1_500;

export type HealthProbePolicy = {
  allowedHosts: readonly string[];
  allowedCidrs: readonly string[];
};

function asIPv4Integer(address: string): number | null {
  if (isIP(address) !== 4) return null;
  return address
    .split(".")
    .reduce((value, octet) => ((value << 8) | Number(octet)) >>> 0, 0);
}

export function isIPv4InCidr(address: string, cidr: string): boolean {
  const parts = cidr.trim().split("/");
  if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1] ?? "")) return false;

  const prefix = Number(parts[1]);
  const base = asIPv4Integer(parts[0] ?? "");
  const candidate = asIPv4Integer(address);
  if (prefix < 0 || prefix > 32 || base === null || candidate === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (base & mask) === (candidate & mask);
}

function isAlwaysForbiddenIPv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  const first = octets[0];
  const second = octets[1];

  // Never probe loopback, unspecified, link-local/metadata or multicast space.
  return (
    first === 0 || first === 127 || (first === 169 && second === 254) || first >= 224
  );
}

function isNonPublicIPv4(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0)
  );
}

export function isAuthorizedHealthAddress(
  hostname: string,
  address: string,
  policy: HealthProbePolicy,
): boolean {
  if (isIP(address) !== 4 || isAlwaysForbiddenIPv4(address)) return false;

  const cidrAllowed = policy.allowedCidrs.some((cidr) => isIPv4InCidr(address, cidr));
  if (cidrAllowed) return true;

  const normalizedHost = hostname.toLowerCase().replace(/\.$/, "");
  const hostAllowed = policy.allowedHosts.some(
    (host) => host.trim().toLowerCase().replace(/\.$/, "") === normalizedHost,
  );
  return hostAllowed && !isNonPublicIPv4(address);
}

export function parseHealthProbeUrl(raw: string): URL | null {
  if (!raw || raw.length > 2048) return null;

  try {
    const parsed = new URL(raw);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.hash
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function resolveAllowedIPv4(
  hostname: string,
  policy: HealthProbePolicy,
): Promise<string> {
  const candidates =
    isIP(hostname) === 4
      ? [hostname]
      : await (async () => {
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            return await Promise.race([
              lookup(hostname, { all: true }).then((results) =>
                results
                  .filter((result) => result.family === 4)
                  .map((result) => result.address),
              ),
              new Promise<string[]>((_, reject) => {
                timeout = setTimeout(
                  () => reject(new Error("DNS lookup timed out")),
                  DNS_TIMEOUT_MS,
                );
              }),
            ]);
          } finally {
            if (timeout) clearTimeout(timeout);
          }
        })();

  const allowed = candidates.find((address) =>
    isAuthorizedHealthAddress(hostname, address, policy),
  );
  if (!allowed) {
    throw new Error("Favorite health destination is not approved");
  }
  return allowed;
}

export async function probeFavoriteHead(
  rawUrl: string,
  policy: HealthProbePolicy,
): Promise<number> {
  const url = parseHealthProbeUrl(rawUrl);
  if (!url) throw new Error("Invalid favorite health URL");

  // DNS is resolved once, checked against the allowlist, then the resulting
  // authorized IPv4 is used directly. This prevents a second DNS lookup
  // (and DNS rebinding between validation and connection).
  const address = await resolveAllowedIPv4(url.hostname, policy);
  const secure = url.protocol === "https:";
  const options: RequestOptions & {
    servername?: string;
    rejectUnauthorized?: boolean;
  } = {
    hostname: address,
    port: url.port || (secure ? 443 : 80),
    method: "HEAD",
    path: url.pathname + url.search,
    headers: {
      Host: url.host,
      "User-Agent": "VestyHub-Health/1.0",
    },
    timeout: REQUEST_TIMEOUT_MS,
    agent: false,
  };

  if (secure) {
    // SNI and certificate verification use the original hostname, not the
    // pinned numeric IP. Reject invalid certificates; do not follow redirects.
    options.servername = url.hostname;
    options.rejectUnauthorized = true;
  }

  return await new Promise<number>((resolve, reject) => {
    const req = (secure ? httpsRequest : httpRequest)(options, (response) => {
      response.resume();
      if (typeof response.statusCode === "number") {
        resolve(response.statusCode);
      } else {
        reject(new Error("Missing HTTP status"));
      }
    });
    req.on("timeout", () => req.destroy(new Error("Health request timed out")));
    req.on("error", reject);
    req.end();
  });
}
