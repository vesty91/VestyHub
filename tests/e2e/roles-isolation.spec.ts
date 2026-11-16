import { expect, test, type Page } from "@playwright/test";

const disposableDatabase =
  "postgresql://vestyhub:ci-only-dummy-password@127.0.0.1:5432/vestyhub_e2e";

test.skip(
  process.env.CI !== "true" ||
    process.env.E2E_RBAC_SEED !== "1" ||
    process.env.DATABASE_URL !== disposableDatabase,
  "RBAC browser tests require the isolated GitHub CI role fixtures.",
);

const accounts = {
  ADMIN: {
    email: "e2e-admin@vestyhub.local",
    password: process.env.E2E_ADMIN_PASSWORD,
    favorite: "E2E ADMIN private service",
  },
  USER: {
    email: "e2e-user@vestyhub.local",
    password: process.env.E2E_USER_PASSWORD,
    favorite: "E2E USER private service",
  },
  VIEWER: {
    email: "e2e-viewer@vestyhub.local",
    password: process.env.E2E_VIEWER_PASSWORD,
    favorite: "E2E VIEWER private service",
  },
} as const;

async function signIn(page: Page, account: (typeof accounts)[keyof typeof accounts]) {
  if (!account.password) {
    throw new Error("A required isolated CI test account is not configured.");
  }

  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(account.email);
  await page.getByLabel("Mot de passe").fill(account.password);
  await page.getByRole("button", { name: "Ouvrir VestyHub" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/favorites");
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
}

async function assertOwnerIsolation(
  page: Page,
  own: (typeof accounts)[keyof typeof accounts],
) {
  await expect(page.getByText(own.favorite).first()).toBeVisible();
  for (const account of Object.values(accounts)) {
    if (account.email !== own.email) {
      await expect(page.getByText(account.favorite)).toHaveCount(0);
    }
  }
}

test("ADMIN sees own favorites and may update the dashboard layout", async ({ page }) => {
  await signIn(page, accounts.ADMIN);
  await assertOwnerIsolation(page, accounts.ADMIN);
  await expect(
    page.getByRole("link", { name: "Ajouter une application" }).first(),
  ).toBeVisible();

  // An empty layout changes nothing but proves that ADMIN can pass the role check.
  const response = await page.request.patch("/api/favorites/layout", {
    data: { items: [] },
  });
  expect(response.status()).toBe(200);
});

test("USER sees only own favorites and cannot edit an ADMIN favorite", async ({
  page,
}) => {
  await signIn(page, accounts.USER);
  await assertOwnerIsolation(page, accounts.USER);
  await expect(
    page.getByRole("link", { name: "Ajouter une application" }).first(),
  ).toBeVisible();

  const allowed = await page.request.patch("/api/favorites/layout", {
    data: { items: [] },
  });
  expect(allowed.status()).toBe(200);

  // The ADMIN fixture ID is deterministic and not owned by this USER.
  await page.goto("/favorites/00000000-0000-4000-8000-00000000a001/edit");
  // Next.js may respond HTTP 200 after streaming a notFound boundary. The
  // security invariant is that no cross-account data or editing UI renders.
  await expect(page.getByText(accounts.ADMIN.favorite)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Enregistrer les modifications" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Nom du service")).toHaveCount(0);
});

test("VIEWER can read own favorites but cannot mutate layouts or create services", async ({
  page,
}) => {
  await signIn(page, accounts.VIEWER);
  await assertOwnerIsolation(page, accounts.VIEWER);

  await expect(page.getByRole("link", { name: "Ajouter une application" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Créer le groupe" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Supprimer" })).toHaveCount(0);

  const denied = await page.request.patch("/api/favorites/layout", {
    data: { items: [] },
  });
  expect(denied.status()).toBe(403);

  await page.goto("/favorites/new");
  await expect(page.getByRole("button", { name: "Créer le favori" })).toHaveCount(0);
});
