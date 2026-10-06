import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockChatService } from "@/services/mock/implementations/mockChatService";
import { writeMockSession } from "@/services/mock/session";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

/**
 * CLAUDE.md: user content always carries its language and dir="auto" (screen readers pick the voice, bidi text
 * lays out right). Arabic shown in the original, on every surface that shows someone's words.
 */
const ARABIC = "مرحبا، كيف حالك اليوم؟";

function expectTagged(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  expect(element).toHaveAttribute("lang", "ar");
  expect(["auto", "rtl"]).toContain(element?.getAttribute("dir"));
}

/** The closest element of `text` that declares a language. */
function tagged(text: string, container: HTMLElement = document.body): HTMLElement | null {
  const node = within(container).getAllByText(text).at(-1);
  return node?.closest("[lang]") ?? null;
}

beforeEach(async () => {
  setViewportWidth(1280);
  mockDb.update((db) => {
    const rafael = db.users["usr_rafael"];
    if (!rafael) return;
    rafael.preferences.translation.displayMode = "original";
    rafael.preferences.translation.autoTranslatePosts = false;
    rafael.preferences.translation.autoTranslateStories = false;
  });
  writeMockSession("usr_omar");
  await mockChatService.sendMessage({
    conversationId: "conv_rafael_omar",
    clientId: "ar-1",
    text: ARABIC,
    media: [],
    replyToId: null,
  });
  signInAs("usr_rafael");
});

describe("user content language", () => {
  it("in the bubble", async () => {
    renderApp("/chats/conv_rafael_omar");
    const log = await screen.findByRole("log", { name: "Messages" });
    await within(log).findByText(ARABIC);
    expectTagged(tagged(ARABIC, log));
  });

  it("in the conversation list preview", async () => {
    renderApp("/chats");
    const list = await screen.findByRole("list", { name: "Chats" });
    await within(list).findByText(ARABIC);
    expectTagged(tagged(ARABIC, list));
  });

  it("in the bar above the composer when replying to it", async () => {
    const user = userEvent.setup();
    renderApp("/chats/conv_rafael_omar");
    const log = await screen.findByRole("log", { name: "Messages" });
    const bubble = (await within(log).findByText(ARABIC)).closest("[id^=message-]");
    if (!(bubble instanceof HTMLElement)) throw new Error("bubble");
    await user.hover(bubble);
    await user.click(within(bubble).getByRole("button", { name: "Message actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reply" }));
    const composer =
      screen.getByRole("textbox", { name: /message/i }).closest("form") ?? document.body;
    expectTagged(tagged(ARABIC, composer as HTMLElement));
  });

  it("in the quote of a reply", async () => {
    const quoted = Object.values(mockDb.read().messages).find((m) => m.clientId === "ar-1");
    await mockChatService.sendMessage({
      conversationId: "conv_rafael_omar",
      clientId: "reply-1",
      text: "Tudo bem!",
      media: [],
      replyToId: quoted?.id ?? null,
    });
    renderApp("/chats/conv_rafael_omar");
    const log = await screen.findByRole("log", { name: "Messages" });
    const quote = await within(log).findByRole("button", { name: /Reply to/ });
    // The server's quote may be the translation: whichever it shows, it says which language it is.
    const preview = within(quote).getByText(/./, { selector: "[dir=auto]" });
    const expected = preview.textContent === ARABIC ? "ar" : "pt-BR";
    expect(preview).toHaveAttribute("lang", expected);
  });

  it("in a post caption", async () => {
    renderApp("/posts/post_omar_1");
    expectTagged(
      tagged(await screen.findByText("شروق الشمس فوق النيل").then((el) => el.textContent ?? "")),
    );
  });
});
