import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/env";
import { assertServerOnly } from "@/lib/security/assert-server";
import * as schema from "./schema";

assertServerOnly("db");

declare global {
  var __vestyhubPgClient: postgres.Sql | undefined;
}

function createClient(): postgres.Sql {
  const env = getEnv();
  return postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
}

const client = globalThis.__vestyhubPgClient ?? createClient();

if (getEnv().NODE_ENV !== "production") {
  globalThis.__vestyhubPgClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;

export async function closeDatabase(): Promise<void> {
  await client.end({ timeout: 5 });
  if (globalThis.__vestyhubPgClient === client) {
    globalThis.__vestyhubPgClient = undefined;
  }
}
