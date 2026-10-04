import { expect, test } from "@playwright/test";

import { prepare, signInAsDemo } from "./support";

test.beforeEach(async ({ context }) => prepare(context));

test("likes and comments on a post", async ({ page }) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/feed");
  const post = page.getByRole("article").first();
  await expect(post).toBeVisible();

  const like = post.getByRole("button", { name: /like/i }).first();
  const before = await like.getAttribute("aria-pressed");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");

  await post
    .getByRole("button", { name: /comment/i })
    .first()
    .click();
  const box = page.getByRole("textbox", { name: /comment/i });
  await box.fill("Que lindo!");
  await box.press("Enter");
  await expect(page.getByText("Que lindo!").first()).toBeVisible();
});

test("stories open from the tray and are driven by the keyboard", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "keyboard navigation is a desktop interaction");
  await signInAsDemo(page, "Rafael");
  await page.goto("/feed");
  await page.getByRole("link", { name: "Open Linh Pham's stories" }).click();
  await expect(page).toHaveURL(/\/stories\//);
  const viewer = page.getByRole("dialog", { name: /Stories of/ });
  await expect(viewer).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/\/stories\//);
});
