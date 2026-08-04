// @vitest-environment node
import { createCipheriv, randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);
const CONTEXT = { connectorId: "11111111-1111-4111-8111-111111111111" };

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "VestyHub",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "b".repeat(32),
  DATABASE_URL: "postgresql://user:pass@localhost:5432/vestyhub",
  AUTH_LOCAL_ENABLED: "true",
  AUTHENTIK_ENABLED: "false",
  DOCKER_CONTROL_ENABLED: "false",
  DOCKER_LOGS_ENABLED: "true",
  SYNOLOGY_ENABLED: "false",
  DEMO_MODE: "false",
};

async function loadEncryptionWith(key: string) {
  vi.resetModules();
  process.env = { ...BASE_ENV, APP_ENCRYPTION_KEY: key } as NodeJS.ProcessEnv;
  return import("./encryption");
}

function createLegacyFixture(payload: unknown, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv, {
    authTagLength: 16,
  });
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

describe("connector secret encryption", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("round-trips JSON with connector-bound AES-GCM AAD", async () => {
    const { encryptPayload, decryptPayload } = await loadEncryptionWith(KEY_A);
    const payload = { username: "admin", token: "s3cr3t", nested: { ok: true } };

    const sealed = encryptPayload(payload, CONTEXT);
    expect(sealed.startsWith("2.")).toBe(true);
    expect(sealed).not.toContain("s3cr3t");
    expect(decryptPayload<typeof payload>(sealed, CONTEXT)).toEqual(payload);
  });

  it("produces randomized ciphertext", async () => {
    const { encryptPayload } = await loadEncryptionWith(KEY_A);
    expect(encryptPayload({ value: 42 }, CONTEXT)).not.toBe(
      encryptPayload({ value: 42 }, CONTEXT),
    );
  });

  it("rejects the wrong key or connector context", async () => {
    const { encryptPayload } = await loadEncryptionWith(KEY_A);
    const sealed = encryptPayload({ secret: "value" }, CONTEXT);

    const wrongKeyModule = await loadEncryptionWith(KEY_B);
    expect(() => wrongKeyModule.decryptPayload(sealed, CONTEXT)).toThrow(
      wrongKeyModule.DecryptionError,
    );

    const correctKeyModule = await loadEncryptionWith(KEY_A);
    expect(() =>
      correctKeyModule.decryptPayload(sealed, { connectorId: "another-connector" }),
    ).toThrow(correctKeyModule.DecryptionError);
  });

  it("keeps legacy version-1 payloads readable for explicit migration", async () => {
    const { decryptPayload } = await loadEncryptionWith(KEY_A);
    const payload = { legacy: true, password: "test-only" };
    const sealed = createLegacyFixture(payload, KEY_A);
    expect(decryptPayload(sealed)).toEqual(payload);
  });

  it("rejects malformed, non-serialisable, and oversized payloads", async () => {
    const {
      decryptPayload,
      DecryptionError,
      encryptPayload,
      EncryptionError,
      ENCRYPTION_PAYLOAD_LIMIT_BYTES,
    } = await loadEncryptionWith(KEY_A);

    expect(() => decryptPayload("not-a-sealed-payload", CONTEXT)).toThrow(
      DecryptionError,
    );

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => encryptPayload(circular, CONTEXT)).toThrow(EncryptionError);
    expect(() =>
      encryptPayload("x".repeat(ENCRYPTION_PAYLOAD_LIMIT_BYTES + 1), CONTEXT),
    ).toThrow(EncryptionError);
  });
});
