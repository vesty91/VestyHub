import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test("an administrator can sign in and open the dashboard", async ({ page }) => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the authenticated flow.",
  );

  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(adminEmail!);
  await page.getByLabel("Mot de passe").fill(adminPassword!);
  await page.getByRole("button", { name: "Ouvrir VestyHub" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Bonjour,/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
  await page.getByRole("link", { name: "Ajouter une application" }).click();
  await expect(page).toHaveURL(/\/favorites\/new$/);
});
