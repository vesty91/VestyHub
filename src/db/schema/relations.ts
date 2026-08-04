import { relations } from "drizzle-orm";

import { accounts, sessions } from "./auth";
import { connectorSecrets, connectors } from "./connectors";
import { dashboardWidgets, dashboards } from "./dashboards";
import { favoriteGroups, favorites } from "./favorites";
import { auditLogs, healthChecks } from "./monitoring";
import { users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  dashboards: many(dashboards),
  favoriteGroups: many(favoriteGroups),
  favorites: many(favorites),
  auditLogs: many(auditLogs),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const dashboardsRelations = relations(dashboards, ({ one, many }) => ({
  user: one(users, { fields: [dashboards.userId], references: [users.id] }),
  widgets: many(dashboardWidgets),
}));

export const dashboardWidgetsRelations = relations(dashboardWidgets, ({ one }) => ({
  dashboard: one(dashboards, {
    fields: [dashboardWidgets.dashboardId],
    references: [dashboards.id],
  }),
  connector: one(connectors, {
    fields: [dashboardWidgets.connectorId],
    references: [connectors.id],
  }),
}));

export const favoriteGroupsRelations = relations(favoriteGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [favoriteGroups.userId],
    references: [users.id],
  }),
  favorites: many(favorites),
}));

export const favoritesRelations = relations(favorites, ({ one, many }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  group: one(favoriteGroups, {
    fields: [favorites.groupId],
    references: [favoriteGroups.id],
  }),
  connector: one(connectors, {
    fields: [favorites.connectorId],
    references: [connectors.id],
  }),
  healthChecks: many(healthChecks),
}));

export const connectorsRelations = relations(connectors, ({ one, many }) => ({
  secret: one(connectorSecrets, {
    fields: [connectors.id],
    references: [connectorSecrets.connectorId],
  }),
  favorites: many(favorites),
  healthChecks: many(healthChecks),
}));

export const connectorSecretsRelations = relations(connectorSecrets, ({ one }) => ({
  connector: one(connectors, {
    fields: [connectorSecrets.connectorId],
    references: [connectors.id],
  }),
}));

export const healthChecksRelations = relations(healthChecks, ({ one }) => ({
  favorite: one(favorites, {
    fields: [healthChecks.favoriteId],
    references: [favorites.id],
  }),
  connector: one(connectors, {
    fields: [healthChecks.connectorId],
    references: [connectors.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));
