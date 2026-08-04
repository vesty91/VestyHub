const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|api[-_]?key|authorization|cookie|encryption[-_]?key|connection[-_]?string|private[-_]?key|client[-_]?secret|session[-_]?id)/i;

const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";

function redactUrlCredentials(input: string): string {
  return input.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)([^\s/@]+)(@)/gi,
    `$1${REDACTED}$3`,
  );
}

/** Masks credentials and common secrets embedded inside free-form strings. */
export function redactSensitiveString(input: string): string {
  return redactUrlCredentials(input)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replace(/\b(Authorization\s*:\s*)([^\r\n]+)/gi, `$1${REDACTED}`)
    .replace(/\b(Set-Cookie|Cookie)\s*:\s*[^\r\n]+/gi, `$1: ${REDACTED}`)
    .replace(
      /([?&](?:access_token|refresh_token|token|api[-_]?key|secret|password|signature)=)[^&#\s]+/gi,
      `$1${REDACTED}`,
    )
    .replace(
      /(["']?(?:password|passwd|secret|token|api[-_]?key|client[-_]?secret)["']?\s*[:=]\s*["']?)[^"'\s,;}]+/gi,
      `$1${REDACTED}`,
    );
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return redactSensitiveString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (typeof value !== "object") return value;

  if (seen.has(value)) return CIRCULAR;
  seen.add(value);

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message),
      stack: value.stack ? redactSensitiveString(value.stack) : undefined,
      cause: sanitize(value.cause, seen),
    };
  }
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, entry]) => [
        redactSensitiveString(String(key)),
        sanitize(entry, seen),
      ]),
    );
  }
  if (value instanceof Set) {
    return [...value].map((entry) => sanitize(entry, seen));
  }
  if (ArrayBuffer.isView(value)) {
    return `[Binary ${value.byteLength} bytes]`;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitize(entry, seen);
  }
  return result;
}

/** Returns a serialisable, deeply redacted copy suitable for logs and audit metadata. */
export function redactSensitiveData(value: unknown): unknown {
  try {
    return sanitize(value, new WeakSet<object>());
  } catch {
    return "[UNSERIALIZABLE]";
  }
}

export const REDACTED_VALUE = REDACTED;
