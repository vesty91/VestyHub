import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: isCi ? "pnpm start" : "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !isCi,
    timeout: 120_000,
    env: {
      ...process.env,
      APP_URL: process.env.APP_URL ?? "http://127.0.0.1:3000",
      APP_PORT: process.env.APP_PORT ?? "3000",
      APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY ?? "a".repeat(64),
      AUTH_SECRET: process.env.AUTH_SECRET ?? "b".repeat(32),
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://vestyhub:vestyhub@127.0.0.1:5432/vestyhub",
      AUTH_LOCAL_ENABLED: "true",
      AUTHENTIK_ENABLED: "false",
      DOCKER_CONTROL_ENABLED: "false",
      DOCKER_LOGS_ENABLED: process.env.DOCKER_LOGS_ENABLED ?? "false",
      SYNOLOGY_ENABLED: "false",
      SYNOLOGY_VERIFY_TLS: "true",
      DEMO_MODE: "false",
    },
  },
});
