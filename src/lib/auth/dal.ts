import { redirect } from "next/navigation";

import { ForbiddenError } from "@/lib/errors";

import { getCurrentSession } from "./session";
import type { AuthenticatedUser, UserRole } from "./types";

const roleWeight: Record<UserRole, number> = {
  VIEWER: 1,
  USER: 2,
  ADMIN: 3,
};

export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return session.user;
}

export async function requireRole(minimumRole: UserRole): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (roleWeight[user.role] < roleWeight[minimumRole]) {
    throw new ForbiddenError();
  }
  return user;
}
