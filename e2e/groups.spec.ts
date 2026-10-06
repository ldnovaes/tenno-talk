import { expect, test, type Page } from "@playwright/test";

import { openChatWith, send, twoPeople } from "./support";

/** Groups (PLAN.md §9.4, §34): created from New chat, read by each member in their own language, one per person. */
async function createGroup(page: Page, title: string, people: string[]) {
  await page.goto("/chats");
  await page.getByRole("button", { name: "New chat" }).click();
  const dialog = page.getByRole("dialog", { name: "New chat" });
  await dialog.getByRole("tab", { name: "New group" }).click();
  await dialog.getByLabel("Group name").fill(title);
  for (const name of people) await dialog.getByRole("checkbox", { name }).click();
  await dialog.getByRole("button", { name: "Create group" }).click();
}

test("a group message reaches every member in their own language", async ({ browser }, info) => {
  const { rafael, linh } = await twoPeople(browser, info.project.use);
  await createGroup(rafael, "Intercâmbio", ["Linh Pham", "Sofía Martínez"]);
  await expect(rafael.getByText("3 members")).toBeVisible();
  await send(rafael, "Tudo bem?");

  await linh.goto("/chats");
  await openChatWith(linh, /Intercâmbio/);
  const log = linh.getByRole("log", { name: "Messages" });
  await expect(log.getByText("Bạn khỏe không?")).toBeVisible();
  await expect(log.getByText("Rafael Souza")).toBeVisible();
});

test("each person creates at most one group", async ({ browser }, info) => {
  const { rafael } = await twoPeople(browser, info.project.use);
  await createGroup(rafael, "Primeiro", ["Linh Pham", "Sofía Martínez"]);
  await expect(rafael.getByText("3 members")).toBeVisible();
  await createGroup(rafael, "Segundo", ["Linh Pham", "Sofía Martínez"]);
  await expect(rafael.getByText(/only one group/i)).toBeVisible();
});
