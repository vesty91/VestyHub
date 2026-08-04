import { loadEnvFile } from "node:process";

import { defineConfig } from "drizzle-kit";

// `drizzle-kit` (unlike Next.js) doesn't load `.env*` files automatically.
// In containers, real variables are already injected via `env_file` — these
// calls are no-ops there since the files won't exist.
for (const file of [".env.local", ".env"]) {
  try {
    loadEnvFile(file);
  } catch {
    // File not found — ignored, see comment above.
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run Drizzle Kit commands.");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
