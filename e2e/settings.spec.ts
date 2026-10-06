import { expect, test } from "@playwright/test";

import { openChatWith, prepare, signInAsDemo, twoPeople } from "./support";

/** Settings changed through the UI, in a real browser (PLAN.md §9.11, §18, §31.1). */
test("the theme chosen in Settings applies at once and survives a reload without a flash", async ({
  page,
  context,
}) => {
  await prepare(context);
  await signInAsDemo(page, "Rafael");
  await page.goto("/settings/appearance");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  // The class must be there before the app paints (public/theme-init.js), not added after.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { darkAtDomReady: boolean }).darkAtDomReady =
        document.documentElement.classList.contains("dark");
    });
  });
  await page.reload();
  expect(
    await page.evaluate(() => (window as unknown as { darkAtDomReady: boolean }).darkAtDomReady),
  ).toBe(true);
});

test("who can message me, changed in Settings, closes the chat on the other side", async ({
  browser,
}, info) => {
  const { rafael, linh } = await twoPeople(browser, info.project.use);
  await rafael.goto("/settings/privacy");
  await rafael.getByRole("combobox", { name: "Who can message me" }).click();
  await rafael.getByRole("option", { name: "Nobody" }).click();
  await expect(rafael.getByRole("combobox", { name: "Who can message me" })).toHaveText("Nobody");

  await linh.goto("/chats");
  await openChatWith(linh, /Rafael/);
  await expect(
    linh.getByRole("status").filter({ hasText: "You can't message this person." }),
  ).toBeVisible();
  await expect(linh.getByRole("textbox", { name: /message/i })).toHaveCount(0);
});

test("a new receiving language applies to the messages that arrive next", async ({
  browser,
}, info) => {
  const { rafael, linh } = await twoPeople(browser, info.project.use);
  await rafael.goto("/settings/language");
  await rafael.getByRole("combobox", { name: "Read messages in" }).click();
  await rafael.getByRole("option", { name: /English \(US\)/ }).click();
  await expect(rafael.getByRole("combobox", { name: "Read messages in" })).toContainText("English");

  await linh.goto("/chats");
  await openChatWith(linh, /Rafael/);
  await linh.getByRole("textbox", { name: /message/i }).fill("Chào buổi sáng");
  await linh.getByRole("button", { name: "Send" }).click();

  await rafael.goto("/chats");
  await openChatWith(rafael, /Linh/);
  await expect(
    rafael.getByRole("log", { name: "Messages" }).getByText("Good morning"),
  ).toBeVisible();
});
