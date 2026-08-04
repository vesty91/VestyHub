import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { assertServerOnly } from "@/lib/security/assert-server";

import {
  createSessionToken,
  getSessionExpiry,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "./session-token";
import type { AuthSession } from "./types";

assertServerOnly("lib/auth/session");

const sessionLogger = logger.child("auth-session");

function shouldUseSecureCookie(): boolean {
  try {
    return new URL(getEnv().APP_URL).protocol === "https:";
  } catch {
    return getEnv().NODE_ENV === "production";
  }
}

export async function createUserSession(userId: string): Promise<Date> {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expires = getSessionExpiry();

  await db.delete(sessions).where(lt(sessions.expires, new Date()));
  await db.insert(sessions).values({
    sessionToken: tokenHash,
    userId,
    expires,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    expires,
  });

  return expires;
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const [row] = await db
    .select({
      expires: sessions.expires,
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      image: users.image,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.sessionToken, tokenHash),
        gt(sessions.expires, new Date()),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    expiresAt: row.expires,
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      image: row.image,
    },
  };
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    if (token) {
      await db.delete(sessions).where(eq(sessions.sessionToken, hashSessionToken(token)));
    }
  } catch (error) {
    sessionLogger.warn("Unable to remove the database session during logout.", {
      error,
    });
  } finally {
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}
