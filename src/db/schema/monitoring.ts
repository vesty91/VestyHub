import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { connectors } from "./connectors";
import { healthStatusEnum } from "./enums";
import { favorites } from "./favorites";
import { users } from "./users";

export const healthChecks = pgTable(
  "health_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    favoriteId: uuid("favorite_id").references(() => favorites.id, {
      onDelete: "cascade",
    }),
    connectorId: uuid("connector_id").references(() => connectors.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    target: text("target").notNull(),
    intervalSeconds: integer("interval_seconds").notNull().default(60),
    timeoutMs: integer("timeout_ms").notNull().default(5000),
    expectedStatus: integer("expected_status"),
    enabled: boolean("enabled").notNull().default(true),
    lastStatus: healthStatusEnum("last_status").notNull().default("unknown"),
    lastLatencyMs: integer("last_latency_ms"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (table) => [
    index("health_checks_favorite_id_idx").on(table.favoriteId),
    index("health_checks_connector_id_idx").on(table.connectorId),
    check("health_checks_interval_seconds_positive", sql`${table.intervalSeconds} > 0`),
    check("health_checks_timeout_ms_positive", sql`${table.timeoutMs} > 0`),
    check(
      "health_checks_expected_status_range",
      sql`${table.expectedStatus} is null or (${table.expectedStatus} between 100 and 599)`,
    ),
    check(
      "health_checks_last_latency_non_negative",
      sql`${table.lastLatencyMs} is null or ${table.lastLatencyMs} >= 0`,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
