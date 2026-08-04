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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { connectors } from "./connectors";
import { users } from "./users";

export const dashboards = pgTable(
  "dashboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    icon: text("icon"),
    isDefault: boolean("is_default").notNull().default(false),
    isShared: boolean("is_shared").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("dashboards_user_slug_idx").on(table.userId, table.slug),
    uniqueIndex("dashboards_one_default_per_user_idx")
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
    index("dashboards_user_id_idx").on(table.userId),
  ],
);

export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    widgetType: text("widget_type").notNull(),
    title: text("title").notNull(),
    connectorId: uuid("connector_id").references(() => connectors.id, {
      onDelete: "set null",
    }),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    positionX: integer("position_x").notNull().default(0),
    positionY: integer("position_y").notNull().default(0),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    minWidth: integer("min_width").notNull().default(1),
    minHeight: integer("min_height").notNull().default(1),
    refreshInterval: integer("refresh_interval_ms").notNull().default(15000),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("dashboard_widgets_dashboard_id_idx").on(table.dashboardId),
    index("dashboard_widgets_connector_id_idx").on(table.connectorId),
    check("dashboard_widgets_width_positive", sql`${table.width} > 0`),
    check("dashboard_widgets_height_positive", sql`${table.height} > 0`),
    check("dashboard_widgets_min_width_positive", sql`${table.minWidth} > 0`),
    check("dashboard_widgets_min_height_positive", sql`${table.minHeight} > 0`),
    check(
      "dashboard_widgets_refresh_interval_minimum",
      sql`${table.refreshInterval} >= 1000`,
    ),
  ],
);

export type Dashboard = typeof dashboards.$inferSelect;
export type NewDashboard = typeof dashboards.$inferInsert;
export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type NewDashboardWidget = typeof dashboardWidgets.$inferInsert;
