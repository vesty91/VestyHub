import { z } from "zod";

import { MONITORING_RANGES } from "@/connectors/monitoring/types";

export const DASHBOARD_WIDGET_TYPES = [
  "clock",
  "favorites",
  "system-status",
  "local-health",
  "monitoring",
] as const;

export const dashboardWidgetTypeSchema = z.enum(DASHBOARD_WIDGET_TYPES);

export const dashboardWidgetSelectionPayloadSchema = z.object({
  dashboardId: z.string().uuid(),
  type: dashboardWidgetTypeSchema,
});

export const dashboardWidgetVisibilityPayloadSchema =
  dashboardWidgetSelectionPayloadSchema.extend({
    isVisible: z.boolean(),
  });

export const clockWidgetConfigurationSchema = z
  .object({
    showSeconds: z.boolean().default(true),
    showDate: z.boolean().default(true),
    hour12: z.boolean().default(false),
  })
  .strict();

export const favoritesWidgetConfigurationSchema = z
  .object({
    limit: z.number().int().min(1).max(8).default(6),
  })
  .strict();

export const systemStatusWidgetConfigurationSchema = z
  .object({
    showDatabase: z.boolean().default(true),
    showDocker: z.boolean().default(true),
    showSession: z.boolean().default(true),
  })
  .strict()
  .refine(
    (configuration) =>
      configuration.showDatabase || configuration.showDocker || configuration.showSession,
    {
      message: "Au moins un bloc de statut doit rester affiché.",
    },
  );

export const localHealthWidgetConfigurationSchema = z
  .object({
    refreshSeconds: z.number().int().min(5).max(60).default(15),
  })
  .strict();

export const monitoringWidgetConfigurationSchema = z
  .object({
    range: z.enum(MONITORING_RANGES).default("1h"),
    showAlerts: z.boolean().default(true),
    showSources: z.boolean().default(true),
  })
  .strict();

export const dashboardWidgetSettingsPayloadSchema = z.discriminatedUnion("type", [
  z
    .object({
      dashboardId: z.string().uuid(),
      type: z.literal("clock"),
      configuration: clockWidgetConfigurationSchema,
    })
    .strict(),
  z
    .object({
      dashboardId: z.string().uuid(),
      type: z.literal("favorites"),
      configuration: favoritesWidgetConfigurationSchema,
    })
    .strict(),
  z
    .object({
      dashboardId: z.string().uuid(),
      type: z.literal("system-status"),
      configuration: systemStatusWidgetConfigurationSchema,
    })
    .strict(),
  z
    .object({
      dashboardId: z.string().uuid(),
      type: z.literal("local-health"),
      configuration: localHealthWidgetConfigurationSchema,
    })
    .strict(),
  z
    .object({
      dashboardId: z.string().uuid(),
      type: z.literal("monitoring"),
      configuration: monitoringWidgetConfigurationSchema,
    })
    .strict(),
]);

export type DashboardWidgetType = z.infer<typeof dashboardWidgetTypeSchema>;
export type ClockWidgetConfiguration = z.infer<typeof clockWidgetConfigurationSchema>;
export type FavoritesWidgetConfiguration = z.infer<
  typeof favoritesWidgetConfigurationSchema
>;
export type SystemStatusWidgetConfiguration = z.infer<
  typeof systemStatusWidgetConfigurationSchema
>;
export type LocalHealthWidgetConfiguration = z.infer<
  typeof localHealthWidgetConfigurationSchema
>;
export type MonitoringWidgetConfiguration = z.infer<
  typeof monitoringWidgetConfigurationSchema
>;
export type DashboardWidgetConfiguration =
  | ClockWidgetConfiguration
  | FavoritesWidgetConfiguration
  | SystemStatusWidgetConfiguration
  | LocalHealthWidgetConfiguration
  | MonitoringWidgetConfiguration;

export type DashboardWidgetConfigurationByType = {
  clock: ClockWidgetConfiguration;
  favorites: FavoritesWidgetConfiguration;
  "system-status": SystemStatusWidgetConfiguration;
  "local-health": LocalHealthWidgetConfiguration;
  monitoring: MonitoringWidgetConfiguration;
};

export type DashboardWidgetDefinition = {
  type: DashboardWidgetType;
  title: string;
  description: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  refreshInterval: number;
};

export const DASHBOARD_WIDGET_CATALOG: readonly DashboardWidgetDefinition[] = [
  {
    type: "clock",
    title: "Horloge",
    description: "Affiche l’heure locale dans le dashboard.",
    width: 2,
    height: 1,
    minWidth: 2,
    minHeight: 1,
    refreshInterval: 1000,
  },
  {
    type: "favorites",
    title: "Favoris",
    description: "Affiche les favoris épinglés pour un accès rapide.",
    width: 4,
    height: 2,
    minWidth: 2,
    minHeight: 2,
    refreshInterval: 15000,
  },
  {
    type: "system-status",
    title: "État du système",
    description: "Résume l’état de Docker et de la base de données.",
    width: 2,
    height: 2,
    minWidth: 2,
    minHeight: 2,
    refreshInterval: 15000,
  },
  {
    type: "local-health",
    title: "Diagnostic local",
    description: "Vérifie régulièrement Next.js et PostgreSQL, même sans NAS.",
    width: 3,
    height: 2,
    minWidth: 2,
    minHeight: 2,
    refreshInterval: 15_000,
  },
  {
    type: "monitoring",
    title: "Monitoring",
    description: "Affiche les métriques Prometheus, alertes et sources d’observabilité.",
    width: 4,
    height: 2,
    minWidth: 3,
    minHeight: 2,
    refreshInterval: 15000,
  },
] as const;

const catalogByType = new Map(
  DASHBOARD_WIDGET_CATALOG.map((definition) => [definition.type, definition]),
);

export function getDashboardWidgetDefinition(
  type: DashboardWidgetType,
): DashboardWidgetDefinition {
  const definition = catalogByType.get(type);
  if (!definition) {
    throw new Error(`Widget dashboard non enregistré : ${type}`);
  }
  return definition;
}

export function parseDashboardWidgetConfiguration<T extends DashboardWidgetType>(
  type: T,
  configuration: unknown,
): DashboardWidgetConfigurationByType[T] {
  switch (type) {
    case "clock":
      return clockWidgetConfigurationSchema.parse(
        configuration,
      ) as DashboardWidgetConfigurationByType[T];
    case "favorites":
      return favoritesWidgetConfigurationSchema.parse(
        configuration,
      ) as DashboardWidgetConfigurationByType[T];
    case "system-status":
      return systemStatusWidgetConfigurationSchema.parse(
        configuration,
      ) as DashboardWidgetConfigurationByType[T];
    case "local-health":
      return localHealthWidgetConfigurationSchema.parse(
        configuration,
      ) as DashboardWidgetConfigurationByType[T];
    case "monitoring":
      return monitoringWidgetConfigurationSchema.parse(
        configuration,
      ) as DashboardWidgetConfigurationByType[T];
  }
}

export function getDefaultDashboardWidgetConfiguration<T extends DashboardWidgetType>(
  type: T,
): DashboardWidgetConfigurationByType[T] {
  return parseDashboardWidgetConfiguration(type, {});
}

export function resolveDashboardWidgetConfiguration<T extends DashboardWidgetType>(
  type: T,
  configuration: unknown,
): DashboardWidgetConfigurationByType[T] {
  try {
    return parseDashboardWidgetConfiguration(type, configuration);
  } catch {
    return getDefaultDashboardWidgetConfiguration(type);
  }
}
