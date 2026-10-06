import { expect, test, type Page } from "@playwright/test";
import { railLink, setPrivacy, signUpAndOnboard } from "./support";

/**
 * Groups on the real stack (PLAN.md §9.4, §31.1): adding someone is messaging them, so their "Who can
 * message me" applies; each person creates one group; members get messages live over wss://.
 */
async function startGroup(page: Page, title: string, people: { username: string; name: string }[]) {
  await page.goto("/chats");
  await page.getByRole("button", { name: "New chat" }).click();
  const dialog = page.getByRole("dialog", { name: "New chat" });
  await dialog.getByRole("tab", { name: "New group" }).click();
  await dialog.getByLabel("Group name").fill(title);
  const search = dialog.getByRole("searchbox");
  const members = dialog.getByRole("list", { name: "Members" });
  for (const person of people) {
    await search.fill(person.username);
    // Usernames are unique: once the search answers, the list holds only that person.
    const found = members.getByRole("checkbox");
    await expect(found).toHaveCount(1);
    await expect(found).toHaveAccessibleName(person.name);
    await found.check();
  }
  await dialog.getByRole("button", { name: "Create group" }).click();
}

/** Chrome logs the expected 400/409 answers as console errors; anything else is a problem. */
function unexpected(problems: string[]) {
  return problems.filter((problem) => !/status of (400|409)/.test(problem));
}

test("a group respects who can message each member and reaches them live", async ({ browser }) => {
  const problems: string[] = [];
  const ana = await signUpAndOnboard(browser, "Ana", "pt-BR", /^Bra[sz]il$/, problems);
  const bo = await signUpAndOnboard(browser, "Bo", "vi-VN", /Vi[eệ]t ?Nam/i, problems);
  const cy = await signUpAndOnboard(browser, "Cy", "es-ES", /^(Spain|España)$/, problems);
  await setPrivacy(cy.page, "Who can message me", "Nobody");

  await startGroup(ana.page, "Intercâmbio", [
    { username: bo.username, name: "Bo" },
    { username: cy.username, name: "Cy" },
  ]);
  await expect(ana.page.getByText("Some people can't be added.")).toBeVisible();

  await setPrivacy(cy.page, "Who can message me", "Everyone");
  await bo.page.goto("/discover");
  await cy.page.goto("/discover");
  await ana.page.getByRole("button", { name: "Create group" }).click();
  await expect(ana.page.getByText("3 members")).toBeVisible();
  await ana.page.getByRole("textbox", { name: /message/i }).fill("Oi, gente!");
  await ana.page.getByRole("button", { name: "Send" }).click();

  for (const member of [bo, cy]) {
    await expect(railLink(member.page, "Chats").getByText("1", { exact: true })).toBeVisible();
  }
  await railLink(bo.page, "Chats").click();
  await bo.page
    .getByRole("list", { name: "Chats" })
    .getByRole("link", { name: /Intercâmbio/ })
    .click();
  const boLog = bo.page.getByRole("log", { name: "Messages" });
  await expect(boLog.getByText("Oi, gente!")).toBeVisible();
  await expect(boLog.getByText("Ana", { exact: true })).toBeVisible();
  await bo.page.getByRole("textbox", { name: /message/i }).fill("Chào mọi người!");
  await bo.page.getByRole("button", { name: "Send" }).click();
  await expect(
    ana.page.getByRole("log", { name: "Messages" }).getByText("Chào mọi người!"),
  ).toBeVisible();

  await startGroup(ana.page, "Segundo", [
    { username: bo.username, name: "Bo" },
    { username: cy.username, name: "Cy" },
  ]);
  await expect(ana.page.getByText("You can create only one group.")).toBeVisible();

  expect(unexpected(problems)).toEqual([]);
});
