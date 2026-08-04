"use server";

import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit";
import { getRequestContext } from "@/lib/auth/request-context";
import { deleteCurrentSession, getCurrentSession } from "@/lib/auth/session";

export async function logoutAction(): Promise<void> {
  const session = await getCurrentSession();
  const context = await getRequestContext();

  await deleteCurrentSession();
  await writeAuditLog({
    userId: session?.user.id,
    action: "auth.logout",
    resourceType: "session",
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  redirect("/login");
}
