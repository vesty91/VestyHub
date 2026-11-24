// @vitest-environment node
import { describe, expect, it } from "vitest";

import { envSchema } from "./index";

const VALID_BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "VestyHub",
  APP_URL: "http://localhost:3000",
  APP_ENCRYPTION_KEY: "a".repeat(64),
  AUTH_SECRET: "b".repeat(32),
  DATABASE_URL: "postgresql://user:pass@localhost:5432/vestyhub",
  AUTH_LOCAL_ENABLED: "true",
  AUTHENTIK_ENABLED: "false",
  DOCKER_CONTROL_ENABLED: "false",
  DOCKER_CONTROL_PROXY_URL: "http://docker-control-proxy:2375",
  DOCKER_LOGS_ENABLED: "true",
  SYNOLOGY_ENABLED: "false",
  DEMO_MODE: "false",
};

function parseEnv(overrides: Record<string, string | undefined> = {}) {
  return envSchema.parse({ ...VALID_BASE_ENV, ...overrides });
}

describe("environment validation", () => {
  it("accepts a valid configuration and applies secure defaults", () => {
    const env = parseEnv({
      AUTH_LOCAL_ENABLED: undefined,
      AUTHENTIK_ENABLED: undefined,
      DOCKER_CONTROL_ENABLED: undefined,
      DOCKER_LOGS_ENABLED: undefined,
      SYNOLOGY_VERIFY_TLS: undefined,
      DEMO_MODE: undefined,
    });

    expect(env.APP_PORT).toBe(3000);
    expect(env.AUTH_LOCAL_ENABLED).toBe(true);
    expect(env.AUTHENTIK_ENABLED).toBe(false);
    expect(env.DOCKER_CONTROL_ENABLED).toBe(false);
    expect(env.DOCKER_LOGS_ENABLED).toBe(true);
    expect(env.SYNOLOGY_VERIFY_TLS).toBe(true);
    expect(env.DEMO_MODE).toBe(false);
  });

  it("rejects boolean typos instead of silently treating them as false", () => {
    expect(() => parseEnv({ SYNOLOGY_VERIFY_TLS: "treu" })).toThrow();
  });

  it("rejects malformed cryptographic and database settings", () => {
    expect(() => parseEnv({ APP_ENCRYPTION_KEY: "not-hex" })).toThrow();
    expect(() => parseEnv({ AUTH_SECRET: "short" })).toThrow();
    expect(() => parseEnv({ DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("requires local auth until an OIDC callback is implemented", () => {
    expect(() => parseEnv({ AUTH_LOCAL_ENABLED: "false" })).toThrow(/AUTH_LOCAL_ENABLED/);
    expect(() => parseEnv({ AUTHENTIK_ENABLED: "true" })).toThrow(/AUTHENTIK_ENABLED/);
  });

  it("allows Docker control only with a pinned Docker engine identity", () => {
    expect(() => parseEnv({ DOCKER_CONTROL_ENABLED: "true" })).toThrow(
      /DOCKER_EXPECTED_HOSTNAME/,
    );
    expect(
      parseEnv({
        DOCKER_CONTROL_ENABLED: "true",
        DOCKER_EXPECTED_HOSTNAME: "synology-nas",
      }).DOCKER_CONTROL_ENABLED,
    ).toBe(true);
    expect(() => parseEnv({ DOCKER_CONTROL_ENABLED: "1" })).toThrow();
    expect(() =>
      parseEnv({
        DOCKER_CONTROL_ENABLED: "true",
        DOCKER_EXPECTED_HOSTNAME: "synology-nas",
        DOCKER_CONTROL_PROXY_URL: "",
      }),
    ).toThrow(/DOCKER_CONTROL_PROXY_URL/);
  });

  it("requires only Prometheus for Synology prometheus mode", () => {
    const env = parseEnv({
      SYNOLOGY_ENABLED: "true",
      SYNOLOGY_MODE: "prometheus",
      PROMETHEUS_URL: "http://prometheus:9090",
    });

    expect(env.SYNOLOGY_USERNAME).toBeUndefined();
    expect(env.PROMETHEUS_URL).toBe("http://prometheus:9090");
  });

  it("requires DSM credentials for dsm-api and hybrid modes", () => {
    expect(() =>
      parseEnv({ SYNOLOGY_ENABLED: "true", SYNOLOGY_MODE: "hybrid" }),
    ).toThrow();

    const env = parseEnv({
      SYNOLOGY_ENABLED: "true",
      SYNOLOGY_MODE: "dsm-api",
      SYNOLOGY_BASE_URL: "https://nas.example.local:5001",
      SYNOLOGY_USERNAME: "vestyhub-readonly",
      SYNOLOGY_PASSWORD: "test-only-password",
    });
    expect(env.SYNOLOGY_VERIFY_TLS).toBe(true);
  });

  it("enforces sane upper and lower bounds", () => {
    expect(() => parseEnv({ PROMETHEUS_TIMEOUT_MS: "249" })).toThrow();
    expect(() => parseEnv({ PROMETHEUS_TIMEOUT_MS: "120001" })).toThrow();
    expect(() => parseEnv({ DEFAULT_REFRESH_INTERVAL: "999" })).toThrow();
    expect(() => parseEnv({ APP_PORT: "70000" })).toThrow();
  });

  it("parses comma-separated allow-lists", () => {
    const env = parseEnv({
      HEALTHCHECK_ALLOWED_CIDRS: "10.0.0.0/8, 192.168.0.0/16",
    });
    expect(env.HEALTHCHECK_ALLOWED_CIDRS).toEqual(["10.0.0.0/8", "192.168.0.0/16"]);
  });
});
