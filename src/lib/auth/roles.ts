import type { UserRole } from "./types";

/** Dashboard mutations require at least the USER role. */
export function canMutateDashboard(role: UserRole): boolean {
  return role === "USER" || role === "ADMIN";
}
