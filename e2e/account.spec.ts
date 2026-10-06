import { expect, test } from "@playwright/test";

import { prepare, signInAsDemo } from "./support";

/** The person's own account (PLAN.md §31 LGPD): edit, download the data, delete. */
test.beforeEach(async ({ context }) => prepare(context));

test("editing the profile shows the new bio on the profile", async ({ page }) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/u/rafael/edit");
  const bio = page.getByLabel("Bio");
  await bio.fill("Aprendendo vietnamita ☕");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/edit$/);
  await page.goto("/u/rafael");
  await expect(page.getByText("Aprendendo vietnamita ☕").first()).toBeVisible();
});

test("downloading my data gives a JSON file with my account", async ({ page }) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/settings/account");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.json$/);
  const text = await (await file.createReadStream()).toArray();
  expect(Buffer.concat(text).toString()).toContain("rafael");
});

test("deleting the account signs out and the account is gone", async ({ page }) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await page.goto("/u/rafael");
  await expect(page).toHaveURL(/\/welcome/);
});
