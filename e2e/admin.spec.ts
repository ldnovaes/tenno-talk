import { expect, test } from "@playwright/test";

import { prepare, signInAsDemo } from "./support";

/** The admin pages (PLAN.md §28.3, §31): for admins only, reached from Settings. */
test.beforeEach(async ({ context }) => prepare(context));

test("an admin reaches AI providers and reports from Settings", async ({ page }) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/settings");
  await page.getByRole("button", { name: "AI providers" }).click();
  await expect(page.getByRole("heading", { name: "OpenAI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anthropic" })).toBeVisible();
  await page.goto("/admin/reports");
  await expect(page.getByRole("radio", { name: "Open" })).toBeVisible();
});

test("someone who isn't an admin is turned away", async ({ page }) => {
  await signInAsDemo(page, "Linh");
  for (const path of ["/admin/ai", "/admin/reports"]) {
    await page.goto(path);
    await expect(page.getByText("This page is for administrators.")).toBeVisible();
  }
});
