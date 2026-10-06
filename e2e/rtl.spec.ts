import { expect, test } from "@playwright/test";

import { openChatWith, prepare, signInAsDemo } from "./support";

/** Arabic content lays out right to left inside the app's left-to-right UI (CLAUDE.md: lang + dir="auto"). */
test("an Arabic conversation shows its original right to left", async ({ page, context }) => {
  await prepare(context);
  await signInAsDemo(page, "Rafael");
  await page.goto("/settings/translation");
  const original = page.getByRole("radio", { name: /^Original only/ });
  await original.click();
  await expect(original).toBeChecked();
  // The preference is saved (mock) before the next full page load.
  await page.waitForTimeout(800);
  await page.goto("/chats");
  await openChatWith(page, /Omar/);
  const arabic = page.getByRole("log", { name: "Messages" }).getByText(/مرحبا/).first();
  await expect(arabic).toBeVisible();
  await expect(arabic).toHaveAttribute("lang", "ar");
  expect(await arabic.evaluate((element) => getComputedStyle(element).direction)).toBe("rtl");
});
