import { expect, test } from "@playwright/test";

import { twoPeople } from "./support";

test("a private profile confirms a follow request from its notifications", async ({
  browser,
}, testInfo) => {
  const { context, rafael, linh } = await twoPeople(browser, testInfo.project.use);
  await rafael.goto("/settings/privacy");
  await rafael.getByRole("combobox", { name: "Profile visibility" }).click();
  await rafael.getByRole("option", { name: "Private" }).click();

  // Linh already follows Rafael in the seed: unfollow, then ask again.
  await linh.goto("/u/rafael");
  await linh.getByRole("button", { name: "Following", exact: true }).click();
  await linh.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(linh.getByRole("button", { name: "Requested", exact: true })).toBeVisible();

  await rafael.goto("/notifications");
  await expect(rafael.getByText("Requested to follow you.")).toBeVisible();
  await rafael.getByRole("button", { name: "Confirm" }).click();
  await expect(rafael.getByText("Requested to follow you.")).toHaveCount(0);

  await linh.goto("/notifications");
  await expect(linh.getByText("Accepted your follow request.")).toBeVisible();
  await context.close();
});
