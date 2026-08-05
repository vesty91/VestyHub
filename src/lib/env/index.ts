import { z } from "zod";

import { assertServerOnly } from "@/lib/security/assert-server";

assertServerOnly("lib/env");

const strictBoolean = (defaultValue: boolean) =>
  z.preprocess(
    (value) => (value === undefined ? String(defaultValue) : value),
    z
      .enum(["true", "false"], {
        error: "Expected the literal string true or false.",
      })
      .transform((value) => value === "true"),
  );

const csvToArray = z
  .string()
  .optional()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const optionalUrl = z.url().optional().or(z.literal(""));
const boundedTimeout = (defaultValue: number) =>
  z.coerce.number().int().min(250).max(120_000).default(defaultValue);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    APP_NAME: z.string().trim().min(1).max(80).default("VestyHub"),
    APP_URL: z.url(),
    APP_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    APP_ENCRYPTION_KEY: z
      .string()
      .regex(
        /^[0-9a-fA-F]{64}$/,
        "APP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).",
      ),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters."),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    AUTH_LOCAL_ENABLED: strictBoolean(true),
    AUTHENTIK_ENABLED: strictBoolean(false),
    AUTHENTIK_ISSUER: optionalUrl,
    AUTHENTIK_CLIENT_ID: z.string().optional().or(z.literal("")),
    AUTHENTIK_CLIENT_SECRET: z.string().optional().or(z.literal("")),

    PROMETHEUS_URL: optionalUrl,
    PROMETHEUS_TIMEOUT_MS: boundedTimeout(5000),
    LOKI_URL: optionalUrl,
    LOKI_TIMEOUT_MS: boundedTimeout(5000),
    ALERTMANAGER_URL: optionalUrl,
    ALERTMANAGER_TIMEOUT_MS: boundedTimeout(5000),

    DOCKER_PROXY_URL: optionalUrl,
    DOCKER_EXPECTED_HOSTNAME: z.string().trim().max(255).optional().or(z.literal("")),
    DOCKER_CONTROL_ENABLED: strictBoolean(false),
    DOCKER_LOGS_ENABLED: strictBoolean(true),

    SYNOLOGY_ENABLED: strictBoolean(false),
    SYNOLOGY_MODE: z.enum(["prometheus", "dsm-api", "hybrid"]).default("hybrid"),
    SYNOLOGY_BASE_URL: optionalUrl,
    SYNOLOGY_USERNAME: z.string().optional().or(z.literal("")),
    SYNOLOGY_PASSWORD: z.string().optional().or(z.literal("")),
    SYNOLOGY_TIMEOUT_MS: boundedTimeout(8000),
    SYNOLOGY_VERIFY_TLS: strictBoolean(true),
    SYNOLOGY_CA_CERT_PATH: z.string().optional().or(z.literal("")),

    HEALTHCHECK_ALLOWED_HOSTS: csvToArray,
    HEALTHCHECK_ALLOWED_CIDRS: csvToArray,

    DEFAULT_REFRESH_INTERVAL: z.coerce
      .number()
      .int()
      .min(1000)
      .max(3_600_000)
      .default(15_000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DEMO_MODE: strictBoolean(false),

    SEED_ADMIN_EMAIL: z.email().default("admin@vestyhub.local"),
    SEED_ADMIN_PASSWORD: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (!value.AUTH_LOCAL_ENABLED && !value.AUTHENTIK_ENABLED) {
      ctx.addIssue({
        code: "custom",
        message:
          "At least one authentication method must be enabled: AUTH_LOCAL_ENABLED or AUTHENTIK_ENABLED.",
        path: ["AUTH_LOCAL_ENABLED"],
      });
    }

    if (value.AUTHENTIK_ENABLED) {
      for (const field of [
        "AUTHENTIK_ISSUER",
        "AUTHENTIK_CLIENT_ID",
        "AUTHENTIK_CLIENT_SECRET",
      ] as const) {
        if (!value[field]) {
          ctx.addIssue({
            code: "custom",
            message: `${field} is required when AUTHENTIK_ENABLED=true.`,
            path: [field],
          });
        }
      }
    }

    if (value.DOCKER_CONTROL_ENABLED) {
      ctx.addIssue({
        code: "custom",
        message:
          "Docker control is intentionally disabled. Set DOCKER_CONTROL_ENABLED=false.",
        path: ["DOCKER_CONTROL_ENABLED"],
      });
    }

    if (value.SYNOLOGY_ENABLED) {
      if (value.SYNOLOGY_MODE === "prometheus") {
        if (!value.PROMETHEUS_URL) {
          ctx.addIssue({
            code: "custom",
            message:
              "PROMETHEUS_URL is required when Synology is enabled in prometheus mode.",
            path: ["PROMETHEUS_URL"],
          });
        }
      } else {
        for (const field of [
          "SYNOLOGY_BASE_URL",
          "SYNOLOGY_USERNAME",
          "SYNOLOGY_PASSWORD",
        ] as const) {
          if (!value[field]) {
            ctx.addIssue({
              code: "custom",
              message: `${field} is required when SYNOLOGY_MODE=${value.SYNOLOGY_MODE}.`,
              path: [field],
            });
          }
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(`\nInvalid environment configuration:\n${formatted}\n`);
    throw new Error("Invalid environment configuration. See details above.");
  }

  return parsed.data;
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  cachedEnv ??= loadEnv();
  return cachedEnv;
}

export { envSchema };
