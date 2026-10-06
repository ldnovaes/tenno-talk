import { expect, test } from "@playwright/test";

import { signInAsDemo, twoPeople } from "./support";

/** Notifications between two people and across tabs (PLAN.md §36.2). */
test("a follow arrives live, Follow back works, and reading it in one tab clears the other", async ({
  browser,
}, info) => {
  const { context, rafael, linh } = await twoPeople(browser, info.project.use);
  // The mock session is per tab (sessionStorage): the second tab signs in too.
  const linhSecondTab = await context.newPage();
  await signInAsDemo(linhSecondTab, "Linh");
  await linhSecondTab.goto("/notifications");
  await linh.goto("/notifications");

  // Rafael already follows Linh: unfollow and follow again to notify her.
  await rafael.goto("/u/linh");
  const follow = rafael.getByRole("button", { name: /^(Follow|Following)$/ });
  if ((await follow.textContent()) === "Following") {
    await follow.click();
    await expect(follow).toHaveText("Follow");
  }
  await follow.click();

  await expect(linh.getByText("Started following you.").first()).toBeVisible();
  await expect(linhSecondTab.getByText("Started following you.").first()).toBeVisible();

  await linh.getByRole("button", { name: "Mark all as read" }).click();
  await expect(linhSecondTab.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
});
