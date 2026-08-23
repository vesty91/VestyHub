export const FAVORITE_HEALTH_STATUSES = [
  "checking",
  "online",
  "degraded",
  "offline",
] as const;

export type FavoriteHealthStatus = (typeof FAVORITE_HEALTH_STATUSES)[number];

export type FavoriteHealthResult = {
  id: string;
  status: FavoriteHealthStatus;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string;
};

export function classifyFavoriteHealthStatus(statusCode: number): FavoriteHealthStatus {
  if (statusCode >= 200 && statusCode < 400) {
    return "online";
  }

  return statusCode < 500 ? "degraded" : "offline";
}

export function getFavoriteHealthLabel(status: FavoriteHealthStatus): string {
  switch (status) {
    case "checking":
      return "Vérification…";
    case "online":
      return "En ligne";
    case "degraded":
      return "Accessible avec avertissement";
    case "offline":
      return "Hors ligne";
  }
}
