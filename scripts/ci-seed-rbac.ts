// Seed isolated, deterministic authorization fixtures for Playwright CI only.
// This file must NEVER run against a local, shared or production database.
import { and, eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import { favorites, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

const expectedDatabase =
  "postgresql://vestyhub:ci-only-dummy-password@127.0.0.1:5432/vestyhub_e2e";
const passwordUser = process.env.E2E_USER_PASSWORD;
const passwordViewer = process.env.E2E_VIEWER_PASSWORD;

if (
  process.env.CI !== "true" ||
  process.env.E2E_RBAC_SEED !== "1" ||
  process.env.DATABASE_URL !== expectedDatabase ||
  process.env.E2E_ADMIN_EMAIL !== "e2e-admin@vestyhub.local" ||
  !passwordUser ||
  !passwordViewer ||
  passwordUser.length < 12 ||
  passwordViewer.length < 12
) {
  throw new Error(
    "RBAC fixture seed refused: disposable GitHub CI environment required.",
  );
}

const accounts = [
  {
    email: "e2e-admin@vestyhub.local",
    role: "ADMIN",
    name: "E2E Administrator",
    favoriteId: "00000000-0000-4000-8000-00000000a001",
    favoriteName: "E2E ADMIN private service",
  },
  {
    email: "e2e-user@vestyhub.local",
    role: "USER",
    name: "E2E Standard User",
    password: passwordUser,
    favoriteId: "00000000-0000-4000-8000-00000000a002",
    favoriteName: "E2E USER private service",
  },
  {
    email: "e2e-viewer@vestyhub.local",
    role: "VIEWER",
    name: "E2E Read Only",
    password: passwordViewer,
    favoriteId: "00000000-0000-4000-8000-00000000a003",
    favoriteName: "E2E VIEWER private service",
  },
] as const;

async function main() {
  for (const account of accounts) {
    let [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, account.email))
      .limit(1);

    if (!user && "password" in account) {
      const [created] = await db
        .insert(users)
        .values({
          email: account.email,
          name: account.name,
          passwordHash: await hashPassword(account.password),
          role: account.role,
          isActive: true,
        })
        .returning({ id: users.id, role: users.role });
      user = created;
    }

    if (!user || user.role !== account.role) {
      throw new Error("RBAC CI user missing or has an unexpected role.");
    }

    const [existingFavorite] = await db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.id, account.favoriteId), eq(favorites.userId, user.id)))
      .limit(1);

    if (!existingFavorite) {
      await db.insert(favorites).values({
        id: account.favoriteId,
        userId: user.id,
        name: account.favoriteName,
        description: "Isolated CI fixture. Not a real service.",
        internalUrl: "https://example.test/",
        iconValue: "shield-check",
        isFavorite: true,
        healthCheckEnabled: false,
      });
    }
  }
  console.log("RBAC_E2E_SEED_OK: three isolated roles and private favorites.");
}

main()
  .catch((error) => {
    console.error("RBAC CI seed failed.", error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
