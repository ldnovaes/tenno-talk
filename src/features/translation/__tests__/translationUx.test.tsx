import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockChatService } from "@/services/mock/implementations/mockChatService";
import { setMockConfig } from "@/services/mock/latency";
import { writeMockSession } from "@/services/mock/session";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";
import type { TranslationDisplayMode } from "@/types/preferences";

const LINH_PT = "Eu também estava com saudade de você.";
const LINH_VI = "Em cũng nhớ anh.";

function setRafaelPreferences(patch: {
  displayMode?: TranslationDisplayMode;
  learningMode?: boolean;
}) {
  mockDb.update((db) => {
    const rafael = db.users["usr_rafael"];
    if (rafael) rafael.preferences.translation = { ...rafael.preferences.translation, ...patch };
  });
}

async function openChat() {
  signInAs("usr_rafael");
  renderApp("/chats/conv_rafael_linh");
  return screen.findByRole("log", { name: "Messages" });
}

function bubbleWith(log: HTMLElement, text: string): HTMLElement {
  const element = within(log).getByText(text).closest("[id^=message-]");
  if (!(element instanceof HTMLElement)) throw new Error(`bubble "${text}" not found`);
  return element;
}

async function openActions(bubble: HTMLElement) {
  await userEvent.click(within(bubble).getByRole("button", { name: "Message actions" }));
}

describe("translation UX", () => {
  beforeEach(() => setViewportWidth(1280));

  it("translation only: received messages appear in my language, mine in the original", async () => {
    const log = await openChat();
    expect(await within(log).findByText(LINH_PT)).toHaveAttribute("lang", "pt-BR");
    expect(within(log).queryByText(LINH_VI)).not.toBeInTheDocument();
    expect(within(log).getByText("Estou com saudade de você.")).toHaveAttribute("lang", "pt-BR");
    expect(within(log).queryByText("Original")).not.toBeInTheDocument();
  });

  it("original + translation: one bubble with the original as secondary", async () => {
    setRafaelPreferences({ displayMode: "both" });
    const log = await openChat();
    const bubble = bubbleWith(log, LINH_PT);
    expect(within(bubble).getByText("Original")).toBeInTheDocument();
    expect(within(bubble).getByText(LINH_VI)).toHaveAttribute("lang", "vi-VN");
    expect(log.querySelectorAll(`[id="${bubble.id}"]`)).toHaveLength(1);
  });

  it("original only: shows the original and lets one message be translated", async () => {
    setRafaelPreferences({ displayMode: "original" });
    const log = await openChat();
    const bubble = bubbleWith(log, LINH_VI);
    expect(within(log).queryByText(LINH_PT)).not.toBeInTheDocument();
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show translation" }));
    expect(await within(bubble).findByText(LINH_PT)).toBeInTheDocument();
  });

  it("show original on a single message, then back to the translation", async () => {
    const log = await openChat();
    const bubble = bubbleWith(log, LINH_PT);
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show original" }));
    expect(await within(bubble).findByText(LINH_VI)).toBeInTheDocument();
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show translation" }));
    expect(await within(bubble).findByText(LINH_PT)).toBeInTheDocument();
  });

  it("own message: show what the other person received", async () => {
    const log = await openChat();
    const bubble = bubbleWith(log, "Perfeito. Mal posso esperar!");
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show translation" }));
    expect(await within(bubble).findByText("Tuyệt vời. Anh mong lắm!")).toHaveAttribute(
      "lang",
      "vi-VN",
    );
  });

  it("keeps the original and offers a retry when translation fails", async () => {
    const log = await openChat();
    setMockConfig({ translationFailureRate: 1 });
    writeMockSession("usr_linh");
    await act(() =>
      mockChatService.sendMessage({
        conversationId: "conv_rafael_linh",
        clientId: "f1",
        text: "Em cũng yêu anh",
        media: [],
        replyToId: null,
      }),
    );
    writeMockSession("usr_rafael");
    const retry = await within(log).findByRole("button", { name: "Retry translation" });
    expect(within(log).getByText("Em cũng yêu anh")).toBeInTheDocument();
    setMockConfig({ translationFailureRate: 0 });
    await userEvent.click(retry);
    expect(await within(log).findByText("Eu também te amo")).toBeInTheDocument();
    expect(
      within(log).queryByRole("button", { name: "Retry translation" }),
    ).not.toBeInTheDocument();
  });

  it("replaces a translation by its improved version", async () => {
    const log = await openChat();
    // A wide gap between v1 and v2 so a slow machine still sees v1 before it is replaced.
    setMockConfig({ improvedTranslationRate: 1, improvedTranslationDelayMs: 1500 });
    writeMockSession("usr_linh");
    await act(() =>
      mockChatService.sendMessage({
        conversationId: "conv_rafael_linh",
        clientId: "v2",
        text: "Em cũng nhớ anh.",
        media: [],
        replyToId: null,
      }),
    );
    writeMockSession("usr_rafael");
    // v1 is the literal rendering, v2 the natural one.
    expect(
      await within(log).findByText("Eu também lembro de você.", undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(within(log).getAllByText(LINH_PT).length).toBe(2), {
      timeout: 4000,
    });
    expect(within(log).queryByText("Eu também lembro de você.")).not.toBeInTheDocument();
  });

  it("learning mode leaves the chat untouched while disabled", async () => {
    const log = await openChat();
    const bubble = bubbleWith(log, LINH_PT);
    await openActions(bubble);
    expect(screen.queryByRole("menuitem", { name: "Learn" })).not.toBeInTheDocument();
  });

  it("learning panel shows natural, original and literal", async () => {
    setRafaelPreferences({ learningMode: true });
    const log = await openChat();
    const bubble = bubbleWith(log, LINH_PT);
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Learn" }));
    const dialog = await screen.findByRole("dialog", { name: "Learning Mode" });
    expect(await within(dialog).findByText("Eu também lembro de você.")).toBeInTheDocument();
    expect(within(dialog).getByText(LINH_VI)).toHaveAttribute("lang", "vi-VN");
    expect(within(dialog).getByText(LINH_PT)).toBeInTheDocument();
    expect(within(dialog).getAllByText("Coming soon")).toHaveLength(3);
  });

  it("settings switch the mode everywhere, including list previews", async () => {
    const user = userEvent.setup();
    signInAs("usr_rafael");
    renderApp("/chats");
    const list = await screen.findByRole("list", { name: "Chats" });
    expect(await within(list).findByText("Você quer comer phở com a gente?")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Settings" }));
    await user.click(await screen.findByRole("button", { name: /Translation/ }));
    await user.click(await screen.findByRole("radio", { name: "Original only" }));
    expect(
      await within(list).findByText("Anh có muốn đi ăn phở cùng tụi em không?"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mockDb.read().users["usr_rafael"]?.preferences.translation.displayMode).toBe(
        "original",
      ),
    );
  });

  it("changing the receiving language translates into the new language", async () => {
    signInAs("usr_rafael");
    renderApp("/settings/translation");
    await screen.findByRole("radio", { name: "Translation only" });
    const { profileService } = await import("@/services/profileService");
    await act(() =>
      profileService.updatePreferences({ translation: { receivingLanguage: "en-US" } }),
    );
    const page = await mockChatService.getMessages("conv_rafael_linh", null);
    await waitFor(async () => {
      const again = await mockChatService.getMessages("conv_rafael_linh", null);
      const linhMessage = again.items.find(
        (m) => m.senderId === "usr_linh" && m.content.type === "text",
      );
      expect(linhMessage?.translation?.targetLanguage).toBe("en-US");
      expect(linhMessage?.translation?.status).toBe("translated");
    });
    expect(page.items.length).toBeGreaterThan(0);
  });
});
