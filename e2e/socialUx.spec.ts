import { expect, test } from "@playwright/test";
import { prepare, signInAsDemo } from "./support";

test.beforeEach(async ({ context }) => prepare(context));

test("follow controls the feed without hiding a public profile's stories", async ({ page }) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/feed");
  await expect(page.getByRole("article", { name: "Post by Linh Pham" }).first()).toBeVisible();
  await page.goto("/u/linh");
  const follow = page.getByRole("button", { name: "Following" });
  await expect(follow).toBeVisible();
  await follow.click();
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Linh Pham's stories" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Feed" }).click();
  await expect(page.getByRole("article", { name: "Post by Linh Pham" })).toHaveCount(0);
  await page.goto("/u/linh");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Feed" }).click();
  await expect(page.getByRole("article", { name: "Post by Linh Pham" }).first()).toBeVisible();
});

test("a story that cannot load still has a working close button", async ({ page }) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/stories/usr_missing");
  await expect(page.getByRole("button", { name: "Close stories" })).toBeVisible();
  await page.getByRole("button", { name: "Close stories" }).click();
  await expect(page).toHaveURL(/\/feed$/);
});
