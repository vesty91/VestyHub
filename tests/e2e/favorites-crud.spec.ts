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
  const groupCreation = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/favorites",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Créer le groupe" }).first().click();
  expect((await groupCreation).ok()).toBe(true);

  // Verify persisted group availability on a fresh server-rendered form; do
  // not rely on a transient action-state success message across RSC refreshes.
  await page.goto("/favorites/new");
  await expect(page).toHaveURL(/\/favorites\/new$/);
  await expect(
    page.getByLabel("Groupe").locator("option", { hasText: groupName }),
  ).toHaveCount(1);

  await page.getByLabel("Nom du service").fill(originalName);
  await page.getByLabel("Description").fill("Created by isolated Playwright CI.");
  await page.getByLabel("URL interne").fill("https://app.example.test/");
  await page.getByLabel("Groupe").selectOption({ label: groupName });
  await page.getByLabel("Tags").fill("e2e, validation");
  const favoriteCreation = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/favorites/new",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Créer le favori" }).click();
  expect((await favoriteCreation).ok()).toBe(true);

  // The server action may finish while Next.js is still committing the
  // client-side redirect on a busy mobile CI runner.
  await expect(page).toHaveURL(/\/favorites$/, { timeout: 15_000 });
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
  const favoriteUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/favorites\/[0-9a-f-]+\/edit$/.test(new URL(response.url()).pathname),
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  expect((await favoriteUpdate).ok()).toBe(true);
  await expect(page).toHaveURL(/\/favorites$/, { timeout: 15_000 });
  await page.getByPlaceholder("Rechercher un favori ou un tag…").fill(editedName);
  const editedCard = page.locator("article").filter({ hasText: editedName });
  await expect(editedCard).toHaveCount(1);
  await expect(editedCard.getByRole("link", { name: "Ouvrir LAN" })).toHaveAttribute(
    "href",
    "https://new.example.test/",
  );

  // A successful server action can outlive the client-side animation.
  // Wait for the POST response, then validate persistence against PostgreSQL
  // after a fresh server-side render instead of racing React revalidation.
  const deletionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/favorites",
    { timeout: 20_000 },
  );
  page.once("dialog", (dialog) => void dialog.accept());
  await editedCard.getByRole("button", { name: "Supprimer" }).click();
  const deleted = await deletionResponse;
  expect(deleted.ok()).toBe(true);

  await page.reload();
  await page.getByPlaceholder("Rechercher un favori ou un tag…").first().fill(editedName);
  await expect(page.getByText("Aucun favori trouvé").first()).toBeVisible();
});
