import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Fixed, security-relevant enumerations live as native Postgres enums.
 * Anything that must stay extensible without a migration (connector types,
 * health-check targets, etc.) is validated at the application layer instead
 * (see `src/types`), and stored as `text`/`varchar`.
 */
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "USER", "VIEWER"]);

export const connectorTestStatusEnum = pgEnum("connector_test_status", [
  "success",
  "failure",
  "unknown",
  "pending",
]);

export const healthStatusEnum = pgEnum("health_status", [
  "available",
  "unavailable",
  "degraded",
  "maintenance",
  "unknown",
]);

export const openModeEnum = pgEnum("open_mode", ["same_tab", "new_tab"]);

export const iconTypeEnum = pgEnum("icon_type", ["lucide", "favicon", "custom", "none"]);
