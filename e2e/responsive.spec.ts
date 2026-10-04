import { expect, test } from "@playwright/test";

import { openChatWith, prepare, signInAsDemo } from "./support";

test.beforeEach(async ({ context }) => prepare(context));

test("mobile: one screen at a time with a bottom bar", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "mobile layout");
  await signInAsDemo(page, "Lucas");
  const bottomNav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(bottomNav).toBeVisible();

  await openChatWith(page, /Cam/);
  await expect(page.getByRole("log", { name: "Messages" })).toBeVisible();
  // The conversation takes the whole screen.
  await expect(bottomNav).toBeHidden();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(bottomNav).toBeVisible();

  // Settings is a full page on mobile.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(412);
});

test("desktop: chats and conversation side by side, profile in a side panel", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "desktop layout");
  await signInAsDemo(page, "Lucas");
  await openChatWith(page, /Cam/);
  await expect(page.getByRole("log", { name: "Messages" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Chats" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // The conversation stays behind the panel.
  await expect(page.getByRole("log", { name: "Messages" })).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
