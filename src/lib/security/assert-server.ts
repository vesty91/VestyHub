/**
 * Lightweight, dependency-free replacement for the `server-only` package.
 *
 * `server-only` relies on a `react-server` package-export condition that
 * Next.js's webpack build applies, but plain Node tooling (Vitest,
 * `drizzle-kit`, `tsx src/db/seed.ts`) does not — there, `server-only`
 * throws unconditionally and breaks scripts and unit tests. This guard
 * produces the same "crashes if it ever reaches the browser" protection
 * using nothing but `typeof window`, so it behaves identically under
 * Next.js, Vitest, and standalone Node scripts.
 */
export function assertServerOnly(moduleName: string): void {
  if (typeof window !== "undefined") {
    throw new Error(
      `"${moduleName}" must only be imported on the server (it may contain secrets or Node-only APIs).`,
    );
  }
}
