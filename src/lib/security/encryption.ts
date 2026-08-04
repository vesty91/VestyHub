import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getEnv } from "@/lib/env";
import { assertServerOnly } from "@/lib/security/assert-server";

assertServerOnly("lib/security/encryption");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const MAX_PLAINTEXT_BYTES = 64 * 1024;
const MAX_SEALED_BYTES = 128 * 1024;
const LEGACY_ENCRYPTION_VERSION = 1;
export const CURRENT_ENCRYPTION_VERSION = 2;

export interface EncryptionContext {
  connectorId: string;
  encryptionVersion?: number;
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

export class DecryptionError extends Error {
  constructor(
    message = "Failed to decrypt payload: invalid key, context, or corrupted data.",
  ) {
    super(message);
    this.name = "DecryptionError";
  }
}

function getKey(): Buffer {
  return Buffer.from(getEnv().APP_ENCRYPTION_KEY, "hex");
}

function buildAad(connectorId: string, version: number): Buffer {
  return Buffer.from(`vestyhub:connector-secret:${connectorId}:v${version}`, "utf8");
}

function serialisePayload(payload: unknown): Buffer {
  let json: string | undefined;
  try {
    json = JSON.stringify(payload);
  } catch {
    throw new EncryptionError("Payload must be valid, non-circular JSON data.");
  }

  if (json === undefined) {
    throw new EncryptionError("Payload must be JSON-serialisable.");
  }

  const plaintext = Buffer.from(json, "utf8");
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
    throw new EncryptionError(
      `Payload exceeds the ${MAX_PLAINTEXT_BYTES}-byte encryption limit.`,
    );
  }

  return plaintext;
}

/**
 * New records use version 2 and authenticate both connectorId and version as
 * AES-GCM additional authenticated data. Legacy version-1 payloads remain
 * readable so key rotation/migration can be performed explicitly.
 */
export function encryptPayload(payload: unknown, context: EncryptionContext): string {
  const version = context.encryptionVersion ?? CURRENT_ENCRYPTION_VERSION;
  if (version !== CURRENT_ENCRYPTION_VERSION) {
    throw new EncryptionError(`Unsupported encryption version for new data: ${version}.`);
  }
  if (!context.connectorId.trim()) {
    throw new EncryptionError("connectorId is required for authenticated encryption.");
  }

  const plaintext = serialisePayload(payload);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  cipher.setAAD(buildAad(context.connectorId, version));

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [String(version), iv, authTag, ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

function parseBase64UrlPart(part: string, expectedLength?: number): Buffer {
  const buffer = Buffer.from(part, "base64url");
  if (expectedLength !== undefined && buffer.byteLength !== expectedLength) {
    throw new DecryptionError("Malformed sealed payload.");
  }
  return buffer;
}

function decryptLegacy<T>(parts: string[]): T {
  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = parseBase64UrlPart(ivPart, IV_LENGTH_BYTES);
  const authTag = parseBase64UrlPart(authTagPart, AUTH_TAG_LENGTH_BYTES);
  const ciphertext = parseBase64UrlPart(ciphertextPart);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

export function decryptPayload<T = unknown>(
  sealed: string,
  context?: EncryptionContext,
): T {
  if (Buffer.byteLength(sealed, "utf8") > MAX_SEALED_BYTES) {
    throw new DecryptionError("Sealed payload exceeds the allowed size.");
  }

  const parts = sealed.split(".");

  try {
    if (parts.length === 3) {
      return decryptLegacy<T>(parts);
    }

    if (parts.length !== 4) {
      throw new DecryptionError("Malformed sealed payload.");
    }

    const [versionPart, ivPart, authTagPart, ciphertextPart] = parts;
    const version = Number(versionPart);
    if (!Number.isInteger(version) || version !== CURRENT_ENCRYPTION_VERSION) {
      throw new DecryptionError(`Unsupported encryption version: ${versionPart}.`);
    }
    if (!context?.connectorId.trim()) {
      throw new DecryptionError("connectorId is required to decrypt version-2 data.");
    }

    const iv = parseBase64UrlPart(ivPart, IV_LENGTH_BYTES);
    const authTag = parseBase64UrlPart(authTagPart, AUTH_TAG_LENGTH_BYTES);
    const ciphertext = parseBase64UrlPart(ciphertextPart);

    const decipher = createDecipheriv(ALGORITHM, getKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAAD(buildAad(context.connectorId, version));
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch (error) {
    if (error instanceof DecryptionError) throw error;
    throw new DecryptionError();
  }
}

export const LEGACY_VERSION = LEGACY_ENCRYPTION_VERSION;
export const ENCRYPTION_PAYLOAD_LIMIT_BYTES = MAX_PLAINTEXT_BYTES;
