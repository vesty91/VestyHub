import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL is missing.");
  process.exit(1);
}

const client = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 5,
  onnotice: (notice) => {
    console.info(`[migrate] PostgreSQL notice: ${notice.message}`);
  },
});

const database = drizzle(client);

try {
  console.info("[migrate] Applying database migrations...");

  await migrate(database, {
    migrationsFolder: "./src/db/migrations",
  });

  console.info("[migrate] Database migrations completed successfully.");
} catch (error) {
  console.error("[migrate] Database migration failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
