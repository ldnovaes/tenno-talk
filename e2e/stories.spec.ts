import { expect, test } from "@playwright/test";

import { openChatWith, twoPeople } from "./support";

/** Stories between two people (PLAN.md §9.9): reacting and replying both end up in their conversation. */
test("a reaction is confirmed in the viewer and arrives in the author's chat", async ({
  browser,
}, info) => {
  const { rafael, linh } = await twoPeople(browser, info.project.use);
  await rafael.goto("/feed");
  await rafael.getByRole("link", { name: "Open Linh Pham's stories" }).click();
  const viewer = rafael.getByRole("dialog", { name: /Stories of Linh Pham/ });
  await expect(viewer).toBeVisible();

  await viewer.getByRole("button", { name: "React ❤️" }).click();
  await expect(viewer.getByRole("status")).toHaveText("Reaction sent");
  // Nothing covers the way out of the viewer.
  await expect(viewer.getByRole("button", { name: "Close stories" })).toBeVisible();
  await expect(rafael.getByText("Reaction sent")).toHaveCount(1);
  if (process.env["STORY_SCREENSHOTS"])
    await rafael.screenshot({
      path:
        "/tmp/claude-1000/-home-caladris-Documentos-tenno-talk/1c5aa5b2-0dfb-4272-8d27-536c0a05bd66/scratchpad/reaction-viewer-" +
        info.project.name +
        ".png",
    });

  await linh.goto("/chats");
  await expect(linh.getByText("Reacted ❤️ to your story").first()).toBeVisible();
  await openChatWith(linh, /Rafael Souza/);
  const log = linh.getByRole("log", { name: "Messages" });
  await expect(log.getByText("Reacted to your story").last()).toBeVisible();
  await expect(log.getByText("❤️", { exact: true }).last()).toBeVisible();
  if (process.env["STORY_SCREENSHOTS"])
    await linh.screenshot({
      path:
        "/tmp/claude-1000/-home-caladris-Documentos-tenno-talk/1c5aa5b2-0dfb-4272-8d27-536c0a05bd66/scratchpad/reaction-chat-" +
        info.project.name +
        ".png",
    });
});

test("a reply is sent privately and shows as a story reply", async ({ browser }, info) => {
  const { rafael, linh } = await twoPeople(browser, info.project.use);
  await rafael.goto("/feed");
  await rafael.getByRole("link", { name: "Open Linh Pham's stories" }).click();
  const viewer = rafael.getByRole("dialog", { name: /Stories of Linh Pham/ });
  const box = viewer.getByRole("textbox", { name: /Reply to Linh Pham/ });
  await box.fill("Que delícia!");
  await viewer.getByRole("button", { name: "Send" }).click();
  await expect(viewer.getByRole("status")).toHaveText("Reply sent");
  await expect(box).toHaveValue("");

  await linh.goto("/chats");
  await openChatWith(linh, /Rafael Souza/);
  await expect(
    linh.getByRole("log", { name: "Messages" }).getByText("Replied to a story").last(),
  ).toBeVisible();
});
