import { expect, test, type Locator, type Page } from "@playwright/test";

import { expectBadge, openChatWith, twoPeople } from "./support";

/**
 * Where a new notification shows up (PLAN.md §6.4, §36.2): a counter on the bell, on the rail (desktop)
 * or in the Chats header (phone), and no toast over the open screen.
 */
function bell(page: Page, isMobile: boolean): Locator {
  return isMobile
    ? page.getByRole("link", { name: /^Notifications/ })
    : page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", {
        name: "Notifications",
      });
}

test("a follow raises the bell's counter on its icon, without a toast", async ({
  browser,
}, info) => {
  const isMobile = info.project.use.isMobile === true;
  const { context, rafael, linh } = await twoPeople(browser, info.project.use);
  await linh.goto("/notifications");
  const markAll = linh.getByRole("button", { name: "Mark all as read" });
  if (await markAll.isEnabled()) await markAll.click();
  await expect(markAll).toBeDisabled();

  await linh.goto("/chats");
  // On a phone the bell lives in the list header; on desktop the person reads a conversation, as reported.
  if (!isMobile) await openChatWith(linh, /Rafael/);

  await rafael.goto("/u/linh");
  const follow = rafael.getByRole("button", { name: /^(Follow|Following)$/ });
  if ((await follow.textContent()) === "Following") {
    await follow.click();
    await expect(follow).toHaveText("Follow");
  }
  await follow.click();

  await expectBadge(bell(linh, isMobile), "1");
  // One look, not a retrying assertion: the old toast was created before the badge, so it would be here now.
  expect(await linh.locator("[data-sonner-toast]").count()).toBe(0);
  await context.close();
});

test("the rail marks the current section", async ({ browser }, info) => {
  test.skip(info.project.use.isMobile === true, "the rail is desktop only");
  const { context, linh } = await twoPeople(browser, info.project.use);
  await linh.goto("/chats");
  await openChatWith(linh, /Rafael/);
  const rail = linh.getByRole("navigation", { name: "Main navigation" });
  const background = (name: string) =>
    rail
      .getByRole("link", { name, exact: true })
      .evaluate((element) => getComputedStyle(element).backgroundColor);
  const current = await background("Chats");
  for (const other of ["Discover", "Feed", "Notifications"])
    expect(await background(other), other).not.toBe(current);
  await context.close();
});
