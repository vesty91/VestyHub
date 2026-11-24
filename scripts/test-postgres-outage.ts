/**
 * Controlled PostgreSQL outage drill against a disposable Docker container.
 *
 * This script never reads .env.local, never connects to a user-configured
 * database, and never stops/restarts the development or production services.
 * Its fixture is stored exclusively in the container's disposable tmpfs.
 */
import { execFileSync } from "node:child_process";

import postgres from "postgres";

const IMAGE = "postgres:17.10-alpine";
const DB_USER = "vestyhub_outage";
const DB_NAME = "vestyhub_outage";
const DB_PASSWORD = "dummy-password-for-disposable-test-only";
const CONTAINER_NAME = `vestyhub-pg-outage-${process.pid}-${Date.now()}`;

function docker(...args: string[]): string {
  return execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(
  condition: () => Promise<boolean>,
  label: string,
  timeoutMs = 25_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function main(): Promise<void> {
  let containerId: string | undefined;
  let paused = false;
  let closeDatabase: (() => Promise<void>) | undefined;
  let fixture: ReturnType<typeof postgres> | undefined;

  try {
    // The random host port, localhost binding and tmpfs prevent accidental
    // contact with any existing PostgreSQL instance or persistent Docker volume.
    containerId = docker(
      "run",
      "--detach",
      "--rm",
      "--name",
      CONTAINER_NAME,
      "--memory",
      "512m",
      "--tmpfs",
      "/var/lib/postgresql/data:rw,size=256m",
      "--publish",
      "127.0.0.1::5432",
      "--env",
      `POSTGRES_USER=${DB_USER}`,
      "--env",
      `POSTGRES_PASSWORD=${DB_PASSWORD}`,
      "--env",
      `POSTGRES_DB=${DB_NAME}`,
      "--health-cmd",
      `pg_isready -U ${DB_USER} -d ${DB_NAME}`,
      "--health-interval",
      "1s",
      "--health-retries",
      "30",
      IMAGE,
    );

    const portMapping = docker("port", containerId, "5432/tcp");
    const portMatch = portMapping.match(/127[.]0[.]0[.]1:([0-9]+)/);
    if (!portMatch) throw new Error("Disposable database has no localhost port");

    const databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${portMatch[1]}/${DB_NAME}`;
    await waitUntil(
      async () =>
        docker("inspect", "--format", "{{.State.Health.Status}}", containerId!) ===
        "healthy",
      "disposable PostgreSQL to become healthy",
    );

    // Set all safety-sensitive options before importing VestyHub's real
    // readiness code, bypassing .env.local and disabling external connectors.
    Object.assign(process.env, {
      NODE_ENV: "test",
      APP_URL: "http://127.0.0.1:3201",
      APP_PORT: "3201",
      APP_ENCRYPTION_KEY: "a".repeat(64),
      AUTH_SECRET: "b".repeat(32),
      DATABASE_URL: databaseUrl,
      AUTH_LOCAL_ENABLED: "true",
      AUTHENTIK_ENABLED: "false",
      AUTHENTIK_ISSUER: "",
      DOCKER_CONTROL_ENABLED: "false",
      DOCKER_LOGS_ENABLED: "false",
      DOCKER_PROXY_URL: "",
      DOCKER_CONTROL_PROXY_URL: "",
      SYNOLOGY_ENABLED: "false",
      SYNOLOGY_BASE_URL: "",
      PROMETHEUS_URL: "",
      LOKI_URL: "",
      ALERTMANAGER_URL: "",
    });

    const dbModule = await import("../src/db/index");
    closeDatabase = dbModule.closeDatabase;
    const { checkDatabaseReadiness } = await import("../src/lib/health/database");
    fixture = postgres(databaseUrl, { max: 1, connect_timeout: 3 });

    await fixture`create table outage_fixture (id integer primary key, value text not null)`;
    await fixture`insert into outage_fixture (id, value) values (1, 'data-preserved')`;

    if (!(await checkDatabaseReadiness())) {
      throw new Error("Initial VestyHub readiness failed");
    }
    console.log("PASS 1/4: actual VestyHub readiness is healthy");

    docker("pause", containerId);
    paused = true;
    if (await checkDatabaseReadiness()) {
      throw new Error("VestyHub did not detect the paused PostgreSQL");
    }
    console.log("PASS 2/4: actual VestyHub readiness rejects an unresponsive database");

    docker("unpause", containerId);
    paused = false;
    await waitUntil(() => checkDatabaseReadiness(), "VestyHub readiness recovery");
    console.log("PASS 3/4: actual VestyHub readiness recovers without a restart");

    const rows = await fixture`select value from outage_fixture where id = 1`;
    if (rows.length !== 1 || rows[0].value !== "data-preserved") {
      throw new Error("Disposable database fixture was not preserved");
    }
    console.log("PASS 4/4: the fixture remains intact after the outage");
  } finally {
    if (containerId) {
      if (paused) {
        try {
          docker("unpause", containerId);
        } catch {
          // Continue to container removal; never operate on other containers.
        }
      }
      if (closeDatabase) {
        try {
          await closeDatabase();
        } catch {
          // Teardown failure should not block disposal.
        }
      }
      if (fixture) {
        try {
          await fixture.end({ timeout: 3 });
        } catch {
          // The disposable instance will be deleted below.
        }
      }
      docker("rm", "--force", containerId);
      console.log("CLEANUP: disposable PostgreSQL container removed");
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    "PostgreSQL outage drill FAILED:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
});
