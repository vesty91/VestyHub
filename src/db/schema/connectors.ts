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

import { connectorTestStatusEnum } from "./enums";

export const connectors = pgTable(
  "connectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    baseUrl: text("base_url").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    verifyTls: boolean("verify_tls").notNull().default(true),
    timeoutMs: integer("timeout_ms").notNull().default(5000),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    lastTestStatus: connectorTestStatusEnum("last_test_status")
      .notNull()
      .default("unknown"),
    lastTestAt: timestamp("last_test_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("connectors_type_idx").on(table.type),
    check("connectors_timeout_ms_positive", sql`${table.timeoutMs} > 0`),
  ],
);

export const connectorSecrets = pgTable(
  "connector_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectorId: uuid("connector_id")
      .notNull()
      .unique()
      .references(() => connectors.id, { onDelete: "cascade" }),
    encryptedPayload: text("encrypted_payload").notNull(),
    encryptionVersion: integer("encryption_version").notNull().default(2),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "connector_secrets_encryption_version_positive",
      sql`${table.encryptionVersion} > 0`,
    ),
  ],
);

export type Connector = typeof connectors.$inferSelect;
export type NewConnector = typeof connectors.$inferInsert;
export type ConnectorSecret = typeof connectorSecrets.$inferSelect;
export type NewConnectorSecret = typeof connectorSecrets.$inferInsert;
