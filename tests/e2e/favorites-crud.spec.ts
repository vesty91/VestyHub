import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

// These tests mutate favorites and groups; run only against the disposable
// PostgreSQL seeded by the dedicated CI job, never a local or NAS database.
test("an administrator can create, filter, edit and remove a favorite", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.CI !== "true" ||
      process.env.E2E_ADMIN_EMAIL !== "e2e-admin@vestyhub.local" ||
      !process.env.DATABASE_URL?.endsWith("/vestyhub_e2e"),
    "Favorite CRUD E2E requires the dedicated disposable CI database.",
  );
  if (!adminEmail || !adminPassword) {
    throw new Error("E2E administrator credentials are missing.");
  }

  const suffix = randomUUID().slice(0, 8);
  const groupName = `CI ${testInfo.project.name} ${suffix}`;
  const originalName = `E2E service ${suffix}`;
  const editedName = `E2E modified ${suffix}`;

  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(adminEmail);
  await page.getByLabel("Mot de passe").fill(adminPassword);
  await page.getByRole("button", { name: "Ouvrir VestyHub" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/favorites");
  await page.getByPlaceholder("Nouveau groupe").first().fill(groupName);
  await page.getByRole("button", { name: "Créer le groupe" }).first().click();
  await expect(page.getByText("Groupe créé.").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Ajouter une application" }).first().click();
  await expect(page).toHaveURL(/\/favorites\/new$/);

  await page.getByLabel("Nom du service").fill(originalName);
  await page.getByLabel("Description").fill("Created by isolated Playwright CI.");
  await page.getByLabel("URL interne").fill("https://app.example.test/");
  await page.getByLabel("Groupe").selectOption({ label: groupName });
  await page.getByLabel("Tags").fill("e2e, validation");
  await page.getByRole("button", { name: "Créer le favori" }).click();

  await expect(page).toHaveURL(/\/favorites$/);
  const search = page.getByPlaceholder("Rechercher un favori ou un tag…");
  await search.fill(originalName);
  const originalCard = page.locator("article").filter({ hasText: originalName });
  await expect(originalCard).toHaveCount(1);
  await expect(originalCard.getByText(groupName)).toBeVisible();
  await expect(originalCard.getByText("e2e", { exact: true }).first()).toBeVisible();

  await originalCard.getByRole("link", { name: "Modifier" }).click();
  await expect(
    page.getByRole("heading", { name: `Modifier ${originalName}` }),
  ).toBeVisible();
  await page.getByLabel("Nom du service").fill(editedName);
  await page.getByLabel("URL interne").fill("https://new.example.test/");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();

  await expect(page).toHaveURL(/\/favorites$/);
  await page.getByPlaceholder("Rechercher un favori ou un tag…").fill(editedName);
  const editedCard = page.locator("article").filter({ hasText: editedName });
  await expect(editedCard).toHaveCount(1);
  await expect(editedCard.getByRole("link", { name: "Ouvrir LAN" })).toHaveAttribute(
    "href",
    "https://new.example.test/",
  );

  page.once("dialog", (dialog) => void dialog.accept());
  await editedCard.getByRole("button", { name: "Supprimer" }).click();
  await expect(editedCard).toHaveCount(0);
  await expect(page.getByText("Aucun favori trouvé")).toBeVisible();

  // A database-backed reload verifies that the deletion persisted.
  await page.reload();
  await page.getByPlaceholder("Rechercher un favori ou un tag…").fill(editedName);
  await expect(page.getByText("Aucun favori trouvé")).toBeVisible();
});
