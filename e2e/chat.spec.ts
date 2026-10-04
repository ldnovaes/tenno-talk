import { expect, test } from "@playwright/test";

import { bubbleWith, openChatWith, prepare, send, signInAsDemo, twoPeople } from "./support";

test("two people chat in real time, each reading in their own language", async ({
  browser,
}, info) => {
  const { context, lucas, cam } = await twoPeople(browser, info.project.use);
  await openChatWith(lucas, /Cam/);
  await openChatWith(cam, /Lucas/);
  const lucasLog = lucas.getByRole("log", { name: "Messages" });
  const camLog = cam.getByRole("log", { name: "Messages" });

  await expect(lucasLog.locator("[id^=message-]").first()).toBeVisible();
  await expect(camLog.locator("[id^=message-]").first()).toBeVisible();

  // Lucas writes Portuguese; Cam reads Vietnamese.
  await send(lucas, "Tudo bem?");
  await expect(lucasLog.getByText("Tudo bem?")).toBeVisible();
  await expect(camLog.getByText("Bạn khỏe không?")).toBeVisible();
  await expect(camLog.getByText("Tudo bem?")).toHaveCount(0);

  // Cam answers in Vietnamese; Lucas reads Portuguese.
  await send(cam, "Chào buổi sáng");
  await expect(lucasLog.getByText("Bom dia")).toBeVisible();

  // Lucas has the chat open, so Cam sees it was read.
  await expect(camLog.getByRole("img", { name: "Read" }).last()).toBeVisible();
  await context.close();
});

test("the original is one tap away", async ({ page, context }, info) => {
  test.skip(
    info.project.name === "mobile",
    "the touch path (long press → drawer) is covered by unit tests",
  );
  await prepare(context);
  await signInAsDemo(page, "Lucas");
  await openChatWith(page, /Cam/);
  const log = page.getByRole("log", { name: "Messages" });
  const bubble = await bubbleWith(log, "Eu também estava com saudade de você.");
  await bubble.hover();
  await bubble.getByRole("button", { name: "Message actions" }).click();
  await page.getByRole("menuitem", { name: "Show original" }).click();
  await expect(bubble.getByText("Em cũng nhớ anh.")).toBeVisible();
  await expect(bubble).toHaveAttribute("id", /message-/);
});
