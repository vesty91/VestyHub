import { z } from "zod";

export const DASHBOARD_WIDGET_TYPES = ["clock", "favorites", "system-status"] as const;

export const dashboardWidgetTypeSchema = z.enum(DASHBOARD_WIDGET_TYPES);

export type DashboardWidgetType = z.infer<typeof dashboardWidgetTypeSchema>;

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
