import { expect, test } from "@playwright/test";

import { prepare, signInAsDemo } from "./support";

test.beforeEach(async ({ context }) => prepare(context));

/** One post per screen, snapping (PLAN.md §37.7): what jsdom cannot check. */
test("discover snaps one post per screen and follows the keyboard", async ({ page }, info) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/discover");
  const feed = page.getByRole("feed", { name: "Posts for you" });
  const slides = feed.getByRole("article");
  await expect(slides.first()).toBeVisible();

  const feedBox = await feed.boundingBox();
  const slideBox = await slides.first().boundingBox();
  expect(slideBox?.height).toBeCloseTo(feedBox?.height ?? 0, 0);

  if (info.project.name !== "mobile") {
    await feed.focus();
    await page.keyboard.press("ArrowDown");
    await expect(slides.nth(1)).toBeInViewport({ ratio: 0.9 });
    await page.keyboard.press("ArrowUp");
    await expect(slides.first()).toBeInViewport({ ratio: 0.9 });
  } else {
    await feed.evaluate((element) => element.scrollBy({ top: element.clientHeight }));
    await expect(slides.nth(1)).toBeInViewport({ ratio: 0.9 });
  }
});

test("not interested hides a post until undone", async ({ page }) => {
  await signInAsDemo(page, "Rafael");
  await page.goto("/discover");
  const first = () => page.getByRole("feed").getByRole("article").first();
  const id = await first().getAttribute("data-post-id");
  await first().getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Not interested" }).click();

  await expect(page.getByText("You won't see this post again")).toBeVisible();
  await expect(first()).not.toHaveAttribute("data-post-id", id ?? "");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(first()).toHaveAttribute("data-post-id", id ?? "");
});
