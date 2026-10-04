import { expect, test } from "@playwright/test";

import { prepare, signInAsDemo } from "./support";

test.beforeEach(async ({ context }) => prepare(context));

/** Everything clickable shows the hand cursor (Tailwind v4 dropped it for buttons). */
test("clickable things show a pointer cursor", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "no cursor on touch screens");
  await page.goto("/welcome");
  const cursor = (locator: ReturnType<typeof page.locator>) =>
    locator.first().evaluate((el) => getComputedStyle(el).cursor);

  expect(await cursor(page.getByRole("button", { name: /Sign in as/ }))).toBe("pointer");
  expect(await cursor(page.getByRole("link", { name: "Continue with email" }))).toBe("pointer");

  await signInAsDemo(page, "Rafael");
  expect(await cursor(page.getByRole("button", { name: "New chat" }))).toBe("pointer");
  expect(await cursor(page.getByRole("radio", { name: "All" }))).toBe("pointer");
  expect(await cursor(page.getByRole("list", { name: "Chats" }).getByRole("link"))).toBe("pointer");

  await page.goto("/chats/conv_rafael_linh");
  expect(await cursor(page.getByRole("button", { name: "Emoji" }))).toBe("pointer");
  // Not available yet: says so instead of looking clickable.
  expect(await cursor(page.getByRole("button", { name: "Calls are coming soon" }))).toBe(
    "not-allowed",
  );
});
