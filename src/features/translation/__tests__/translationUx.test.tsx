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

const CAM_PT = "Eu também estava com saudade de você.";
const CAM_VI = "Em cũng nhớ anh.";

function setLucasPreferences(patch: {
  displayMode?: TranslationDisplayMode;
  learningMode?: boolean;
}) {
  mockDb.update((db) => {
    const lucas = db.users["usr_lucas"];
    if (lucas) lucas.preferences.translation = { ...lucas.preferences.translation, ...patch };
  });
}

async function openChat() {
  signInAs("usr_lucas");
  renderApp("/chats/conv_lucas_cam");
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
    expect(await within(log).findByText(CAM_PT)).toHaveAttribute("lang", "pt-BR");
    expect(within(log).queryByText(CAM_VI)).not.toBeInTheDocument();
    expect(within(log).getByText("Estou com saudade de você.")).toHaveAttribute("lang", "pt-BR");
    expect(within(log).queryByText("Original")).not.toBeInTheDocument();
  });

  it("original + translation: one bubble with the original as secondary", async () => {
    setLucasPreferences({ displayMode: "both" });
    const log = await openChat();
    const bubble = bubbleWith(log, CAM_PT);
    expect(within(bubble).getByText("Original")).toBeInTheDocument();
    expect(within(bubble).getByText(CAM_VI)).toHaveAttribute("lang", "vi-VN");
    expect(log.querySelectorAll(`[id="${bubble.id}"]`)).toHaveLength(1);
  });

  it("original only: shows the original and lets one message be translated", async () => {
    setLucasPreferences({ displayMode: "original" });
    const log = await openChat();
    const bubble = bubbleWith(log, CAM_VI);
    expect(within(log).queryByText(CAM_PT)).not.toBeInTheDocument();
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show translation" }));
    expect(await within(bubble).findByText(CAM_PT)).toBeInTheDocument();
  });

  it("show original on a single message, then back to the translation", async () => {
    const log = await openChat();
    const bubble = bubbleWith(log, CAM_PT);
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show original" }));
    expect(await within(bubble).findByText(CAM_VI)).toBeInTheDocument();
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Show translation" }));
    expect(await within(bubble).findByText(CAM_PT)).toBeInTheDocument();
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
    writeMockSession("usr_cam");
    await act(() =>
      mockChatService.sendMessage({
        conversationId: "conv_lucas_cam",
        clientId: "f1",
        text: "Em cũng yêu anh",
        media: [],
        replyToId: null,
      }),
    );
    writeMockSession("usr_lucas");
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
    setMockConfig({ improvedTranslationRate: 1, improvedTranslationDelayMs: 500 });
    writeMockSession("usr_cam");
    await act(() =>
      mockChatService.sendMessage({
        conversationId: "conv_lucas_cam",
        clientId: "v2",
        text: "Em cũng nhớ anh.",
        media: [],
        replyToId: null,
      }),
    );
    writeMockSession("usr_lucas");
    // v1 is the literal rendering, v2 the natural one.
    expect(await within(log).findByText("Eu também lembro de você.")).toBeInTheDocument();
    await waitFor(() => expect(within(log).getAllByText(CAM_PT).length).toBe(2));
    expect(within(log).queryByText("Eu também lembro de você.")).not.toBeInTheDocument();
  });

  it("learning mode leaves the chat untouched while disabled", async () => {
    const log = await openChat();
    const bubble = bubbleWith(log, CAM_PT);
    await openActions(bubble);
    expect(screen.queryByRole("menuitem", { name: "Learn" })).not.toBeInTheDocument();
  });

  it("learning panel shows natural, original and literal", async () => {
    setLucasPreferences({ learningMode: true });
    const log = await openChat();
    const bubble = bubbleWith(log, CAM_PT);
    await openActions(bubble);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Learn" }));
    const dialog = await screen.findByRole("dialog", { name: "Learning Mode" });
    expect(await within(dialog).findByText("Eu também lembro de você.")).toBeInTheDocument();
    expect(within(dialog).getByText(CAM_VI)).toHaveAttribute("lang", "vi-VN");
    expect(within(dialog).getByText(CAM_PT)).toBeInTheDocument();
    expect(within(dialog).getAllByText("Coming soon")).toHaveLength(3);
  });

  it("settings switch the mode everywhere, including list previews", async () => {
    const user = userEvent.setup();
    signInAs("usr_lucas");
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
      expect(mockDb.read().users["usr_lucas"]?.preferences.translation.displayMode).toBe(
        "original",
      ),
    );
  });

  it("changing the receiving language translates into the new language", async () => {
    signInAs("usr_lucas");
    renderApp("/settings/translation");
    await screen.findByRole("radio", { name: "Translation only" });
    const { profileService } = await import("@/services/profileService");
    await act(() =>
      profileService.updatePreferences({ translation: { receivingLanguage: "en-US" } }),
    );
    const page = await mockChatService.getMessages("conv_lucas_cam", null);
    await waitFor(async () => {
      const again = await mockChatService.getMessages("conv_lucas_cam", null);
      const camMessage = again.items.find(
        (m) => m.senderId === "usr_cam" && m.content.type === "text",
      );
      expect(camMessage?.translation?.targetLanguage).toBe("en-US");
      expect(camMessage?.translation?.status).toBe("translated");
    });
    expect(page.items.length).toBeGreaterThan(0);
  });
});
