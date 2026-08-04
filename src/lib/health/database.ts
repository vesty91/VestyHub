import { sql } from "drizzle-orm";

import { db } from "@/db";

const DATABASE_HEALTH_TIMEOUT_MS = 3000;

export async function checkDatabaseReadiness(): Promise<boolean> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database readiness timeout.")),
          DATABASE_HEALTH_TIMEOUT_MS,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
