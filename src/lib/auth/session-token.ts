import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "vestyhub_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getSessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_MS);
}
