import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, ".env.local");
if (fs.existsSync(dest)) {
  console.log("Existing .env.local preserved. No passwords were regenerated.");
  process.exit(0);
}

const dbPassword = randomBytes(24).toString("hex");
const adminPassword = randomBytes(24).toString("base64url");
const encryptionKey = randomBytes(32).toString("hex");
const authSecret = randomBytes(32).toString("base64url");

const vars = {
  NODE_ENV: "development",
  APP_NAME: "VestyHub Local",
  APP_URL: "http://127.0.0.1:3200",
  APP_PORT: "3200",
  APP_ENCRYPTION_KEY: encryptionKey,
  AUTH_SECRET: authSecret,
  POSTGRES_USER: "vestyhub_dev",
  POSTGRES_PASSWORD: dbPassword,
  POSTGRES_DB: "vestyhub_dev",
  DATABASE_URL: `postgresql://vestyhub_dev:${dbPassword}@127.0.0.1:15432/vestyhub_dev`,
  AUTH_LOCAL_ENABLED: "true",
  AUTHENTIK_ENABLED: "false",
  PROMETHEUS_URL: "",
  LOKI_URL: "",
  ALERTMANAGER_URL: "",
  DOCKER_PROXY_URL: "",
  DOCKER_CONTROL_PROXY_URL: "",
  DOCKER_EXPECTED_HOSTNAME: "",
  DOCKER_CONTROL_ENABLED: "false",
  DOCKER_LOGS_ENABLED: "false",
  SYNOLOGY_ENABLED: "false",
  SYNOLOGY_VERIFY_TLS: "true",
  DEMO_MODE: "false",
  SEED_ADMIN_EMAIL: "admin@vestyhub.local",
  SEED_ADMIN_PASSWORD: adminPassword,
};
const file =
  "# Local-only generated secrets. Never commit this file.\n" +
  Object.entries(vars)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") +
  "\n";
fs.writeFileSync(dest, file, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log("Created .env.local with separate random DB and admin credentials.");
console.log("Credentials remain local in .env.local; do not commit or share them.");
