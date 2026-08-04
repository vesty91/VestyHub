import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { iconTypeEnum, openModeEnum } from "./enums";
import { connectors } from "./connectors";
import { users } from "./users";

export const favoriteGroups = pgTable(
  "favorite_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("favorite_groups_user_id_idx").on(table.userId)],
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => favoriteGroups.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    internalUrl: text("internal_url"),
    externalUrl: text("external_url"),
    iconType: iconTypeEnum("icon_type").notNull().default("lucide"),
    iconValue: text("icon_value"),
    tags: jsonb("tags").notNull().default([]),
    openMode: openModeEnum("open_mode").notNull().default("new_tab"),
    healthCheckEnabled: boolean("health_check_enabled").notNull().default(false),
    healthCheckUrl: text("health_check_url"),
    dockerContainerId: text("docker_container_id"),
    connectorId: uuid("connector_id").references(() => connectors.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("favorites_user_id_idx").on(table.userId),
    index("favorites_group_id_idx").on(table.groupId),
  ],
);

export type FavoriteGroup = typeof favoriteGroups.$inferSelect;
export type NewFavoriteGroup = typeof favoriteGroups.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
