/**
 * Real Chromium recovery drill for VestyHub, with a fully disposable PostgreSQL.
 *
 * Never reads .env.local into child processes and never touches NAS, existing
 * PostgreSQL containers, named volumes or the normal Next.js build directory.
 * Runs only against a random loopback port and its own uniquely named Docker
 * container and Next dev compilation cache.
 */
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

import { chromium, expect, type Browser } from "@playwright/test";
import postgres from "postgres";

const ROOT = process.cwd();
const IMAGE = "postgres:17.10-alpine";
const PG_USER = "vestyhub_browser_outage";
const PG_DB = "vestyhub_browser_outage";
const PG_PASSWORD = "disposable-browser-outage-password";
const ADMIN_EMAIL = "browser-outage@vestyhub.local";
const ADMIN_PASSWORD = "disposable-browser-outage-admin-password";
const RUN_ID = `${process.pid}-${Date.now()}`;
const CONTAINER = `vestyhub-pg-browser-outage-${RUN_ID}`;
const DIST_DIR = `.next-outage-browser-${RUN_ID}`;
const TS_CONFIG_NAME = `tsconfig.outage-browser-${RUN_ID}.json`;
const IS_WINDOWS = process.platform === "win32";

function docker(...args: string[]): string {
  return execFileSync("docker", args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  test: () => Promise<boolean>,
  label: string,
  timeoutMs = 45_000,
): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if (await test()) return;
    } catch {
      // Transient failure: retry until the bounded deadline.
    }
    await sleep(500);
  }
  throw new Error(`Timed out while waiting for ${label}`);
}

async function freeLoopbackPort(): Promise<number> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a loopback port"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function pnpm(args: string[], env: NodeJS.ProcessEnv): void {
  const command = IS_WINDOWS ? "cmd.exe" : "pnpm";
  const commandArgs = IS_WINDOWS ? ["/d", "/c", "pnpm", ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 150_000,
  });
  if (result.error || result.status !== 0) {
    // Never print raw stderr: an ORM exception can include connection details.
    throw new Error(
      `Isolated pnpm ${args.slice(0, 3).join(" ")} failed (code ${result.status}).`,
    );
  }
}

async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (!child?.pid || child.exitCode !== null) return;
  if (IS_WINDOWS) {
    // Stop only the command tree started by this script, not existing dev servers.
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
        timeout: 10_000,
      });
    } catch {
      // A child that already exited needs no termination.
    }
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Process already exited.
    }
  }
  await sleep(500);
}

async function main(): Promise<void> {
  let containerId: string | undefined;
  let paused = false;
  let next: ChildProcess | undefined;
  let browser: Browser | undefined;
  let fixture: ReturnType<typeof postgres> | undefined;
  let nextOutput = "";

  try {
    containerId = docker(
      "run",
      "--detach",
      "--rm",
      "--name",
      CONTAINER,
      "--memory",
      "512m",
      "--tmpfs",
      "/var/lib/postgresql/data:rw,size=256m",
      "--publish",
      "127.0.0.1::5432",
      "--env",
      `POSTGRES_USER=${PG_USER}`,
      "--env",
      `POSTGRES_PASSWORD=${PG_PASSWORD}`,
      "--env",
      `POSTGRES_DB=${PG_DB}`,
      "--health-cmd",
      `pg_isready -U ${PG_USER} -d ${PG_DB}`,
      "--health-interval",
      "1s",
      "--health-retries",
      "30",
      IMAGE,
    );
    const mapping = docker("port", containerId, "5432/tcp");
    const portMatch = mapping.match(/127[.]0[.]0[.]1:([0-9]+)/);
    if (!portMatch) throw new Error("Disposable PostgreSQL has no loopback port");

    await waitFor(
      async () =>
        docker("inspect", "--format", "{{.State.Health.Status}}", containerId!) ===
        "healthy",
      "isolated PostgreSQL health",
    );

    const appPort = await freeLoopbackPort();
    const url = `http://127.0.0.1:${appPort}`;
    const databaseUrl = `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${portMatch[1]}/${PG_DB}`;

    // Explicitly override all sensitive and connector-specific configuration:
    // Next.js's normal dotenv load does not override process environment.
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      VESTYHUB_OUTAGE_TEST_DIST_DIR: DIST_DIR,
      APP_NAME: "VestyHub Isolated Browser Test",
      APP_URL: url,
      APP_PORT: String(appPort),
      APP_ENCRYPTION_KEY: "a".repeat(64),
      AUTH_SECRET: "b".repeat(32),
      DATABASE_URL: databaseUrl,
      AUTH_LOCAL_ENABLED: "true",
      AUTHENTIK_ENABLED: "false",
      AUTHENTIK_ISSUER: "",
      AUTHENTIK_CLIENT_ID: "",
      AUTHENTIK_CLIENT_SECRET: "",
      DOCKER_CONTROL_ENABLED: "false",
      DOCKER_LOGS_ENABLED: "false",
      DOCKER_PROXY_URL: "",
      DOCKER_CONTROL_PROXY_URL: "",
      DOCKER_EXPECTED_HOSTNAME: "",
      SYNOLOGY_ENABLED: "false",
      SYNOLOGY_BASE_URL: "",
      SYNOLOGY_USERNAME: "",
      SYNOLOGY_PASSWORD: "",
      PROMETHEUS_URL: "",
      LOKI_URL: "",
      ALERTMANAGER_URL: "",
      HEALTHCHECK_ALLOWED_HOSTS: "",
      HEALTHCHECK_ALLOWED_CIDRS: "",
      SEED_ADMIN_EMAIL: ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
      DEMO_MODE: "false",
    };

    pnpm(["exec", "tsx", "src/db/migrate.ts"], env);
    pnpm(["exec", "tsx", "src/db/seed.ts"], env);
    fixture = postgres(databaseUrl, { max: 1, connect_timeout: 3 });
    await fixture`create table browser_outage_probe (id integer primary key, value text not null)`;
    await fixture`insert into browser_outage_probe (id, value) values (1, 'retained')`;

    // Next.js updates its configured tsconfig at runtime; direct those edits
    // to a disposable copy rather than the project's tracked tsconfig.json.
    copyFileSync(join(ROOT, "tsconfig.json"), join(ROOT, TS_CONFIG_NAME));

    const nextArgs = [
      "exec",
      "next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ];
    next = spawn(
      IS_WINDOWS ? "cmd.exe" : "pnpm",
      IS_WINDOWS ? ["/d", "/c", "pnpm", ...nextArgs] : nextArgs,
      {
        cwd: ROOT,
        env,
        windowsHide: true,
        detached: !IS_WINDOWS,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    next.on("error", () => undefined);
    const capture = (chunk: Buffer) => {
      nextOutput = (nextOutput + chunk.toString("utf8")).slice(-8_000);
    };
    next.stdout?.on("data", capture);
    next.stderr?.on("data", capture);

    await waitFor(
      async () => {
        if (next?.exitCode !== null) throw new Error("Isolated Next process stopped");
        const response = await fetch(`${url}/api/health/live`, {
          signal: AbortSignal.timeout(1500),
        });
        return response.status === 200;
      },
      "isolated Next.js",
      120_000,
    );

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: url });
    const page = await context.newPage();
    page.setDefaultTimeout(35_000);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await page.getByLabel("Adresse e-mail").fill(ADMIN_EMAIL);
    await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Ouvrir VestyHub" }).click();
    await expect(page).toHaveURL(/[/]dashboard$/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { name: /Bonjour,/ })).toBeVisible();
    console.log("PASS 1/5: authenticated dashboard loads in real Chromium");

    docker("pause", containerId);
    paused = true;
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(
      page.getByRole("heading", { name: "PostgreSQL est indisponible" }),
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeDisabled();
    console.log("PASS 2/5: real browser displays PostgreSQL outage with retry blocked");

    const unhealthy = await page.request.get("/api/health/ready", { timeout: 12_000 });
    if (unhealthy.status() !== 503) throw new Error("Readiness did not return HTTP 503");
    console.log("PASS 3/5: readiness returns HTTP 503 during actual outage");

    docker("unpause", containerId);
    paused = false;
    await waitFor(
      async () => {
        const response = await page.request.get("/api/health/ready", { timeout: 6_000 });
        return response.status() === 200;
      },
      "HTTP 200 after PostgreSQL recovery",
      25_000,
    );
    // Polling should work automatically; offer manual fallback if not yet visible.
    if (
      !(await page
        .getByRole("heading", { name: "PostgreSQL répond de nouveau" })
        .isVisible())
    ) {
      const verify = page.getByRole("button", { name: "Vérifier PostgreSQL" });
      if (await verify.isEnabled()) await verify.click();
    }
    await expect(
      page.getByRole("heading", { name: "PostgreSQL répond de nouveau" }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Reprendre VestyHub" }).click();
    await expect(page.getByRole("heading", { name: /Bonjour,/ })).toBeVisible({
      timeout: 45_000,
    });
    console.log("PASS 4/5: existing authenticated session restores the dashboard");

    const rows = await fixture`select value from browser_outage_probe where id = 1`;
    if (rows.length !== 1 || rows[0].value !== "retained") {
      throw new Error("The disposable test record was lost");
    }
    console.log("PASS 5/5: database record survived the outage");
    await context.close();
  } catch (error) {
    console.error(
      "Isolated Chromium outage drill FAILED:",
      error instanceof Error ? error.message : "unknown failure",
    );
    if (nextOutput) {
      // Last Next diagnostics can contain SQL arguments; never dump them into CI.
      console.error("Inspect isolated Next.js logs locally if necessary.");
    }
    process.exitCode = 1;
  } finally {
    await browser?.close().catch(() => undefined);
    if (containerId && paused) {
      try {
        docker("unpause", containerId);
      } catch {
        // Continue cleanup of this disposable container only.
      }
    }
    await stopChild(next);
    await fixture?.end({ timeout: 3 }).catch(() => undefined);
    if (containerId) {
      try {
        docker("rm", "--force", containerId);
      } catch {
        process.exitCode = 1;
        console.error(
          "CLEANUP FAILED: manually inspect the uniquely named disposable container.",
        );
      }
    }
    // Only remove this run's own Next.js build cache and tsconfig copy.
    try {
      rmSync(join(ROOT, TS_CONFIG_NAME), { force: true });
      rmSync(join(ROOT, DIST_DIR), {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
      });
    } catch {
      console.error("CLEANUP WARNING: isolated Next.js cache could not be deleted.");
    }
    console.log("CLEANUP: isolated browser drill resources released");
  }
}

void main();
