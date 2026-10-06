import { expect, test } from "@playwright/test";
import { publishPost, railLink, signUpAndOnboard } from "./support";

/**
 * The path reported broken in production on 2026-10-04: open a profile from Discover and from a
 * chat, and see the Chats and Notifications badges rise when a message arrives. Discover shows posts
 * since PLAN.md §37, so Bo posts first: a brand-new post reaches someone who knows nothing about Bo.
 */

test("profiles open from Discover and chats, and an arriving message raises both badges", async ({
  browser,
}) => {
  const problems: string[] = [];
  const ana = await signUpAndOnboard(browser, "Ana", "pt-BR", /^Bra[sz]il$/, problems);
  const bo = await signUpAndOnboard(browser, "Bo", "vi-VN", /Vi[eệ]t ?Nam/i, problems);

  await publishPost(bo.page, "Xin chào #travel");

  await ana.page.goto("/discover");
  // The database outlives runs, and earlier runs' Bo posted the same caption: pick this Bo's post.
  const boLink = ana.page.getByRole("link", { name: new RegExp(`@${bo.username}`) });
  const post = ana.page.getByRole("article", { name: "Post by Bo" }).filter({ has: boLink });
  await expect(post.getByText("Xin chào #travel")).toBeVisible();
  await post.getByRole("link", { name: new RegExp(`@${bo.username}`) }).click();
  const boProfile = ana.page.getByRole("dialog");
  await expect(boProfile.getByRole("heading", { name: `@${bo.username}` })).toBeVisible();
  await expect(boProfile.getByText("User not found")).toHaveCount(0);

  // Bo waits outside the chat, where only the badges can tell a message arrived.
  await bo.page.goto("/discover");
  await expect(railLink(bo.page, "Chats").getByText("1")).toHaveCount(0);

  await boProfile.getByRole("button", { name: "Message" }).click();
  await ana.page.getByRole("textbox", { name: /message/i }).fill("Oi Bo!");
  await ana.page.getByRole("button", { name: "Send" }).click();

  await expect(railLink(bo.page, "Chats").getByText("1", { exact: true })).toBeVisible();
  await expect(railLink(bo.page, "Notifications").getByText("1", { exact: true })).toBeVisible();

  await railLink(bo.page, "Chats").click();
  await bo.page.getByRole("list", { name: "Chats" }).getByRole("link", { name: /Ana/ }).click();
  await bo.page.getByRole("button", { name: "Open Ana's profile" }).click();
  await expect(bo.page.getByRole("heading", { name: `@${ana.username}` })).toBeVisible();
  await expect(bo.page.getByText("User not found")).toHaveCount(0);

  expect(problems).toEqual([]);
});
