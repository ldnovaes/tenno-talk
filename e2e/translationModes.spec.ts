import { expect, test, type Page } from "@playwright/test";

import { bubbleWith, prepare, signInAsDemo } from "./support";

test.beforeEach(async ({ context }) => prepare(context));

async function chooseMode(page: Page, mode: RegExp) {
  await page.goto("/settings/translation");
  const radio = page.getByRole("radio", { name: mode });
  await radio.click();
  await expect(radio).toBeChecked();
  // The preference is saved on the server (mock) before we leave the page.
  await page.waitForTimeout(800);
}

test("display modes change every message at once", async ({ page }) => {
  await signInAsDemo(page, "Lucas");
  await chooseMode(page, /Original \+ Translation/);
  await page.goto("/chats/conv_lucas_cam");
  const log = page.getByRole("log", { name: "Messages" });
  const bubble = await bubbleWith(log, "Eu também estava com saudade de você.");
  await expect(bubble.getByText("Original", { exact: true })).toBeVisible();
  await expect(bubble.getByText("Em cũng nhớ anh.")).toBeVisible();

  await chooseMode(page, /Original only/);
  await page.goto("/chats/conv_lucas_cam");
  await expect(log.getByText("Em cũng nhớ anh.")).toBeVisible();
  await expect(log.getByText("Eu também estava com saudade de você.")).toHaveCount(0);
});
