/**
 * Bounded wait for read-only database operations used by server-rendered pages.
 *
 * This rejects the HTTP rendering work when a PostgreSQL connection is silent.
 * It does NOT cancel the underlying query, roll back transactions or make
 * writes safe to retry. Use for reads only; the query can finish later.
 */
export class DatabaseReadTimeoutError extends Error {
  constructor() {
    super("Database read timed out.");
    this.name = "DatabaseReadTimeoutError";
  }
}

export function withDatabaseReadDeadline<T>(
  query: PromiseLike<T>,
  timeoutMs = 8_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DatabaseReadTimeoutError()), timeoutMs);
  });

  return Promise.race([Promise.resolve(query), deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
