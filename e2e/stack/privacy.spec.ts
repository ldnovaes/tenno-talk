import { expect, test, type Locator, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./support";

/**
 * The privacy paths reported broken in production on 2026-10-05 (PLAN.md §31.1), replayed on the real stack:
 * a block, an unblock and "People I follow"; a private sender writing to "People I follow". Each ends with the
 * other person's Chats badge rising, which is how the missing counters showed up.
 */
function railLink(page: Page, name: string): Locator {
  return page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name });
}

async function setPrivacy(page: Page, setting: string, value: string) {
  await page.goto("/settings/privacy");
  await page.getByRole("combobox", { name: setting }).click();
  await page.getByRole("option", { name: value }).click();
  await expect(page.getByRole("combobox", { name: setting })).toHaveText(value);
}

async function follow(page: Page, username: string, expected: "Following" | "Requested") {
  await page.goto(`/u/${username}`);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByRole("button", { name: expected })).toBeVisible();
}

test("a block and an unblock say why a chat can't send, and a follow back reopens it", async ({
  browser,
}) => {
  const problems: string[] = [];
  const ana = await signUpAndOnboard(browser, "Ana", "pt-BR", /^Bra[sz]il$/, problems);
  const bo = await signUpAndOnboard(browser, "Bo", "vi-VN", /Vi[eệ]t ?Nam/i, problems);
  await setPrivacy(bo.page, "Who can message me", "People I follow");
  await follow(bo.page, ana.username, "Following");
  await bo.page.goto("/discover");

  await ana.page.goto(`/u/${bo.username}`);
  await ana.page.getByRole("button", { name: "Message" }).click();
  await ana.page.getByRole("textbox", { name: /message/i }).fill("Oi Bo!");
  await ana.page.getByRole("button", { name: "Send" }).click();
  await expect(railLink(bo.page, "Chats").getByText("1", { exact: true })).toBeVisible();
  const chat = ana.page.url();

  // Blocking keeps the profile, with a notice, instead of "User not found".
  await ana.page.goto(`/u/${bo.username}`);
  await ana.page.getByRole("button", { name: "Profile menu" }).click();
  await ana.page.getByRole("menuitem", { name: "Block Bo" }).click();
  await ana.page.getByRole("alertdialog").getByRole("button", { name: "Block Bo" }).click();
  await expect(ana.page.getByText("You blocked Bo", { exact: true })).toBeVisible();
  await expect(ana.page.getByText("User not found")).toHaveCount(0);

  await ana.page.goto(chat);
  await expect(ana.page.getByText("You blocked Bo.")).toBeVisible();
  await ana.page.getByRole("button", { name: "Unblock" }).click();
  // The block removed Bo's follow, and Bo only accepts messages from people Bo follows.
  await expect(
    ana.page.getByText("Bo only accepts messages from people they follow."),
  ).toBeVisible();

  await follow(bo.page, ana.username, "Following");
  await bo.page.goto("/discover");
  await expect(ana.page.getByRole("textbox", { name: /message/i })).toBeVisible();
  await ana.page.getByRole("textbox", { name: /message/i }).fill("Voltei");
  await ana.page.getByRole("button", { name: "Send" }).click();
  await expect(railLink(bo.page, "Chats").getByText("2", { exact: true })).toBeVisible();

  expect(problems.filter((p) => !/403/.test(p))).toEqual([]);
});

test("a private sender reaches a People-I-follow account as soon as it asks to follow back", async ({
  browser,
}) => {
  const problems: string[] = [];
  const ana = await signUpAndOnboard(browser, "Ana", "pt-BR", /^Bra[sz]il$/, problems);
  const bo = await signUpAndOnboard(browser, "Bo", "vi-VN", /Vi[eệ]t ?Nam/i, problems);
  await setPrivacy(ana.page, "Profile visibility", "Private");
  await setPrivacy(bo.page, "Who can message me", "People I follow");

  await ana.page.goto(`/u/${bo.username}`);
  await ana.page.getByRole("button", { name: "Message" }).click();
  await expect(
    ana.page.getByText("This person only accepts messages from people they follow."),
  ).toBeVisible();

  // Ana is private, so Bo's follow becomes a request; asking already shows Bo's interest.
  await follow(bo.page, ana.username, "Requested");
  await bo.page.goto("/discover");
  await ana.page.getByRole("button", { name: "Message" }).click();
  await ana.page.getByRole("textbox", { name: /message/i }).fill("Oi!");
  await ana.page.getByRole("button", { name: "Send" }).click();
  await expect(railLink(bo.page, "Chats").getByText("1", { exact: true })).toBeVisible();
  await expect(railLink(ana.page, "Notifications").getByText("1", { exact: true })).toBeVisible();

  expect(problems.filter((p) => !/403/.test(p))).toEqual([]);
});
