import { expect, test } from "@playwright/test";

import { bubbleWith, openChatWith, prepare, send, signInAsDemo, twoPeople } from "./support";

test("two people chat in real time, each reading in their own language", async ({
  browser,
}, info) => {
  const { context, rafael, linh } = await twoPeople(browser, info.project.use);
  await openChatWith(rafael, /Linh/);
  await openChatWith(linh, /Rafael/);
  const rafaelLog = rafael.getByRole("log", { name: "Messages" });
  const linhLog = linh.getByRole("log", { name: "Messages" });

  await expect(rafaelLog.locator("[id^=message-]").first()).toBeVisible();
  await expect(linhLog.locator("[id^=message-]").first()).toBeVisible();

  // Rafael writes Portuguese; Linh reads Vietnamese.
  await send(rafael, "Tudo bem?");
  await expect(rafaelLog.getByText("Tudo bem?")).toBeVisible();
  await expect(linhLog.getByText("Bạn khỏe không?")).toBeVisible();
  await expect(linhLog.getByText("Tudo bem?")).toHaveCount(0);

  // Linh answers in Vietnamese; Rafael reads Portuguese.
  await send(linh, "Chào buổi sáng");
  await expect(rafaelLog.getByText("Bom dia")).toBeVisible();

  // Rafael has the chat open, so Linh sees it was read.
  await expect(linhLog.getByRole("img", { name: "Read" }).last()).toBeVisible();
  await context.close();
});

test("the original is one tap away", async ({ page, context }, info) => {
  test.skip(
    info.project.name === "mobile",
    "the touch path (long press → drawer) is covered by unit tests",
  );
  await prepare(context);
  await signInAsDemo(page, "Rafael");
  await openChatWith(page, /Linh/);
  const log = page.getByRole("log", { name: "Messages" });
  const bubble = await bubbleWith(log, "Eu também estava com saudade de você.");
  await bubble.hover();
  await bubble.getByRole("button", { name: "Message actions" }).click();
  await page.getByRole("menuitem", { name: "Show original" }).click();
  await expect(bubble.getByText("Em cũng nhớ anh.")).toBeVisible();
  await expect(bubble).toHaveAttribute("id", /message-/);
});
