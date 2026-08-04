import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { logger } from "@/lib/logging/logger";

const auditLogger = logger.child("audit");

export interface AuditEvent {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: event.userId ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      metadata: event.metadata ?? {},
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
    });
  } catch (error) {
    auditLogger.warn("Unable to persist audit event.", {
      action: event.action,
      resourceType: event.resourceType,
      error,
    });
  }
}
