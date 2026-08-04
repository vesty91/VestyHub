import { hash, verify } from "@node-rs/argon2";

import { assertServerOnly } from "@/lib/security/assert-server";

assertServerOnly("lib/auth/password");

/**
 * Argon2id password hashing for local accounts (`users.password_hash`).
 * OWASP-recommended baseline parameters for an interactive login endpoint.
 *
 * `Algorithm` is declared as a TypeScript `const enum` by `@node-rs/argon2`,
 * which can't be referenced as a value under `isolatedModules` (required by
 * Next.js's SWC compiler). `2` is `Algorithm.Argon2id` — verified against
 * the package's own runtime export.
 */
const ARGON2ID = 2;

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, ARGON2_OPTIONS);
}

export function verifyPassword(
  hashedPassword: string,
  plainPassword: string,
): Promise<boolean> {
  return verify(hashedPassword, plainPassword, ARGON2_OPTIONS);
}
