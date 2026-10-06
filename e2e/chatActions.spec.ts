import { expect, test, type Locator, type Page } from "@playwright/test";

import { bubbleWith, openChatWith, signInAsDemo } from "./support";

/**
 * What you do with a message (PLAN.md §9.4): the desktop menu and the phone's long press. A failed send
 * (Retry/Discard) is in chatFlow.test.tsx: the mock fails every call of a session, sign-in included.
 */
const MOCK = {
  minLatencyMs: 20,
  maxLatencyMs: 60,
  failureRate: 0,
  translationFailureRate: 0,
  improvedTranslationRate: 0,
  translationDelayMs: 200,
  autoReply: false,
};

async function start(page: Page) {
  await page.context().addInitScript((config) => {
    localStorage.setItem("tenno.mock-config", JSON.stringify(config));
  }, MOCK);
  await signInAsDemo(page, "Rafael");
  await openChatWith(page, /Linh/);
  return page.getByRole("log", { name: "Messages" });
}

/** Opens a message's actions the way each device does it. */
async function actionsOf(page: Page, bubble: Locator, mobile: boolean) {
  if (mobile) {
    // On the bubble's text: the long-press listener sits inside the message row.
    const target = bubble.locator("p").first();
    const box = await target.boundingBox();
    if (!box) throw new Error("bubble not visible");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await target.dispatchEvent("pointerdown", {
      pointerType: "touch",
      clientX: x,
      clientY: y,
      isPrimary: true,
    });
    const drawer = page.getByRole("dialog", { name: "Message actions" });
    await expect(drawer).toBeVisible();
    return drawer;
  }
  await bubble.hover();
  await bubble.getByRole("button", { name: "Message actions" }).click();
  return page.getByRole("menu");
}

test("reply and react, with the menu on desktop and a long press on phones", async ({
  page,
}, info) => {
  const mobile = info.project.name === "mobile";
  const log = await start(page);
  const bubble = await bubbleWith(log, "Perfeito. Mal posso esperar!");

  let actions = await actionsOf(page, bubble, mobile);
  await actions.getByRole(mobile ? "button" : "menuitem", { name: "Reply" }).click();
  await expect(page.getByText(/Replying to/)).toBeVisible();
  await page.getByRole("textbox", { name: /message/i }).fill("Combinado!");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(log.getByText("Combinado!", { exact: true })).toBeVisible();
  const reply = log.locator("[id^=message-]").last();
  await expect(reply.getByRole("button", { name: /Reply to/ })).toContainText(
    "Perfeito. Mal posso esperar!",
  );

  actions = await actionsOf(page, bubble, mobile);
  await actions.getByRole(mobile ? "button" : "menuitem", { name: /React ❤️/ }).click();
  await expect(bubble.getByRole("button", { name: /❤️/ })).toBeVisible();
});
