"use server";

import { and, eq, lt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
} from "@/lib/auth/rate-limit";
import { getRequestContext, hashAuditIdentifier } from "@/lib/auth/request-context";
import { loginSchema } from "@/lib/auth/schemas";
import { createUserSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

import type { LoginState } from "./state";

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!getEnv().AUTH_LOCAL_ENABLED) {
    return {
      status: "error",
      message: "L’authentification locale est désactivée.",
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vérifie les informations saisies.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const context = await getRequestContext();
  const emailHash = hashAuditIdentifier(parsed.data.email);
  const rateLimitKey = `${context.ipAddress ?? "unknown"}:${emailHash}`;
  const rateLimit = checkLoginRateLimit(rateLimitKey);

  if (!rateLimit.allowed) {
    return {
      status: "error",
      message: `Trop de tentatives. Réessaie dans ${rateLimit.retryAfterSeconds} secondes.`,
    };
  }

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`)
    .limit(1);

  let credentialsValid = false;
  if (user?.passwordHash && user.isActive) {
    credentialsValid = await verifyPassword(user.passwordHash, parsed.data.password);
  } else {
    // Keeps invalid-user requests computationally expensive enough to reduce
    // trivial account enumeration without logging the submitted password.
    await hashPassword(parsed.data.password);
  }

  if (!user || !credentialsValid || !user.isActive) {
    recordLoginFailure(rateLimitKey);
    await writeAuditLog({
      action: "auth.login.failed",
      resourceType: "session",
      metadata: { emailHash },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      status: "error",
      message: "Adresse e-mail ou mot de passe incorrect.",
    };
  }

  resetLoginRateLimit(rateLimitKey);
  await db.delete(sessions).where(lt(sessions.expires, new Date()));
  await createUserSession(user.id);
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, user.id), eq(users.isActive, true)));

  await writeAuditLog({
    userId: user.id,
    action: "auth.login.succeeded",
    resourceType: "session",
    metadata: {},
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  redirect("/dashboard");
}
