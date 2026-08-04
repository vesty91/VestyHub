import { createHash } from "node:crypto";

import { headers } from "next/headers";

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export async function getRequestContext(): Promise<RequestContext> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;

  return {
    ipAddress,
    userAgent: requestHeaders.get("user-agent"),
  };
}

export function hashAuditIdentifier(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 24);
}
