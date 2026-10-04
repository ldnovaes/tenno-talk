import { expect, test } from "@playwright/test";

import { prepare } from "./support";

test.beforeEach(async ({ context }) => prepare(context));

test("a new person signs up, accepts the terms and completes onboarding", async ({ page }) => {
  // The way a visitor gets there: welcome → email → "Create one".
  await page.goto("/welcome");
  await page.getByRole("link", { name: "Continue with email" }).click();
  await page.getByRole("link", { name: "Create one" }).click();
  // The page loads on demand: fill the new form, not the one still on screen.
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Email").fill("new.person@example.com");
  await page.getByLabel("Password", { exact: true }).fill("secret123");
  await page.getByLabel("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/onboarding\/welcome/);
  // The terms must be accepted before anything else.
  await page.getByRole("button", { name: /continue/i }).click();
  await expect(
    page.getByText("You need to accept the Terms of Use and Privacy Policy to continue."),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page).toHaveURL(/native-language/);
  await page.getByRole("button", { name: /continue/i }).click();
  await expect(page).toHaveURL(/receive-language/);
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page).toHaveURL(/onboarding\/profile/);
  await page.getByLabel("Name", { exact: true }).fill("New Person");
  await page.getByLabel("Username", { exact: true }).fill("new.person");
  await expect(page.getByText("Username available")).toBeVisible();
  await page.getByRole("combobox", { name: "Country" }).click();
  await page.getByRole("option", { name: "Brazil" }).click();
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page).toHaveURL(/onboarding\/discover/);
  await page.getByRole("button", { name: "Start chatting" }).click();
  await expect(page).toHaveURL(/\/chats/);

  // The session survives a reload.
  await page.reload();
  await expect(page).toHaveURL(/\/chats/);
});
