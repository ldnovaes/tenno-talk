import { expect, test } from "@playwright/test";
import { publishPost, railLink, setPrivacy, signUpAndOnboard } from "./support";

/**
 * Follow requests on the real stack (PLAN.md §31.1): a private profile hides its posts until it
 * approves; both sides hear about it live through the Notifications badge; a declined request
 * leaves the profile closed and lets the person ask again.
 */
test("a private profile approves one request and declines another, live on both sides", async ({
  browser,
}) => {
  const problems: string[] = [];
  const bo = await signUpAndOnboard(browser, "Bo", "vi-VN", /Vi[eệ]t ?Nam/i, problems);
  const ana = await signUpAndOnboard(browser, "Ana", "pt-BR", /^Bra[sz]il$/, problems);
  const cy = await signUpAndOnboard(browser, "Cy", "es-ES", /^(Spain|España)$/, problems);
  await publishPost(bo.page, "Chỉ dành cho bạn bè");
  await setPrivacy(bo.page, "Profile visibility", "Private");
  await bo.page.goto("/discover");

  for (const person of [ana, cy]) {
    await person.page.goto(`/u/${bo.username}`);
    await expect(person.page.getByText("This account is private")).toBeVisible();
    await expect(person.page.getByText("Chỉ dành cho bạn bè")).toHaveCount(0);
    await person.page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(person.page.getByRole("button", { name: "Requested" })).toBeVisible();
  }
  await expect(railLink(bo.page, "Notifications").getByText("2", { exact: true })).toBeVisible();

  await ana.page.goto("/discover");
  await railLink(bo.page, "Notifications").click();
  const anaRequest = bo.page.getByRole("listitem").filter({ hasText: "Ana" });
  await expect(anaRequest.getByText("Requested to follow you.")).toBeVisible();
  await anaRequest.getByRole("button", { name: "Confirm" }).click();
  await expect(anaRequest.getByText("Requested to follow you.")).toHaveCount(0);

  await expect(railLink(ana.page, "Notifications").getByText("1", { exact: true })).toBeVisible();
  await railLink(ana.page, "Notifications").click();
  await expect(ana.page.getByText("Accepted your follow request.")).toBeVisible();
  await ana.page.goto(`/u/${bo.username}`);
  await expect(ana.page.getByRole("button", { name: "Following" })).toBeVisible();
  await expect(ana.page.getByText("This account is private")).toHaveCount(0);

  await bo.page.goto("/settings/privacy");
  await bo.page
    .getByRole("listitem")
    .filter({ hasText: "Cy" })
    .getByRole("button", { name: "Decline" })
    .click();
  await expect(bo.page.getByText("No follow requests yet.")).toBeVisible();
  await cy.page.goto(`/u/${bo.username}`);
  await expect(cy.page.getByText("This account is private")).toBeVisible();
  await expect(cy.page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();

  expect(problems).toEqual([]);
});
