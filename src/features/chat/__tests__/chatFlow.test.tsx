import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { publish } from "@/services/mock/events";
import { mockChatService } from "@/services/mock/implementations/mockChatService";
import { setMockConfig } from "@/services/mock/latency";
import { writeMockSession } from "@/services/mock/session";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

async function openConversation(id = "conv_rafael_linh") {
  signInAs("usr_rafael");
  renderApp(`/chats/${id}`);
  const log = await screen.findByRole("log", { name: "Messages" });
  return { log, input: screen.getByRole("textbox", { name: "Message" }) };
}

/** Acts as another user on the mock backend while the UI stays signed in as Rafael. */
async function asOtherUser<T>(userId: string, action: () => Promise<T>): Promise<T> {
  writeMockSession(userId);
  try {
    return await act(action);
  } finally {
    writeMockSession("usr_rafael");
  }
}

describe("chat", () => {
  beforeEach(() => setViewportWidth(1280));

  it("sends a message optimistically and confirms it", async () => {
    const user = userEvent.setup();
    const { log, input } = await openConversation();
    await user.type(input, "Olá, tudo bem?{Enter}");
    expect(await within(log).findByText("Olá, tudo bem?")).toBeInTheDocument();
    expect(input).toHaveValue("");
    await waitFor(() =>
      expect(within(log).getAllByRole("img", { name: "Sent" }).length).toBeGreaterThan(0),
    );
    const list = screen.getByRole("list", { name: "Chats" });
    expect(await within(list).findByText("You: Olá, tudo bem?")).toBeInTheDocument();
  });

  it("keeps a failed message with retry and does not duplicate it", async () => {
    const user = userEvent.setup();
    const { log, input } = await openConversation();
    setMockConfig({ failureRate: 1 });
    await user.type(input, "Mensagem difícil{Enter}");
    expect(await within(log).findByText("Not sent.")).toBeInTheDocument();
    setMockConfig({ failureRate: 0 });
    await user.click(within(log).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(within(log).queryByText("Not sent.")).not.toBeInTheDocument());
    expect(within(log).getAllByText("Mensagem difícil")).toHaveLength(1);
  });

  it("discards a failed message", async () => {
    const user = userEvent.setup();
    const { log, input } = await openConversation();
    setMockConfig({ failureRate: 1 });
    await user.type(input, "Descartar{Enter}");
    await user.click(await within(log).findByRole("button", { name: "Discard" }));
    expect(within(log).queryByText("Descartar")).not.toBeInTheDocument();
  });

  it("replies to a message", async () => {
    const user = userEvent.setup();
    const { log, input } = await openConversation();
    const bubble = within(log)
      .getByText("Pode ser! Sábado às 8 da noite, então.")
      .closest("[id^=message-]");
    if (!(bubble instanceof HTMLElement)) throw new Error("bubble not found");
    await user.click(within(bubble).getByRole("button", { name: "Message actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reply" }));
    expect(screen.getByText("Replying to Linh Pham")).toBeInTheDocument();
    await user.type(input, "Combinado!{Enter}");
    const quote = await within(log).findByRole("button", { name: "Reply to Linh Pham" });
    expect(quote).toHaveTextContent("Pode ser! Sábado às 8 da noite, então.");
    expect(screen.queryByText("Replying to Linh Pham")).not.toBeInTheDocument();
  });

  it("cancels a reply with Escape", async () => {
    const user = userEvent.setup();
    const { log, input } = await openConversation();
    const bubble = within(log).getByText("Boa noite 🌙").closest("[id^=message-]");
    if (!(bubble instanceof HTMLElement)) throw new Error("bubble not found");
    await user.click(within(bubble).getByRole("button", { name: "Message actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reply" }));
    await user.type(input, "{Escape}");
    expect(screen.queryByText("Replying to Linh Pham")).not.toBeInTheDocument();
  });

  it("reacts and removes the reaction", async () => {
    const user = userEvent.setup();
    const { log } = await openConversation();
    const bubble = within(log).getByText("Boa noite 🌙").closest("[id^=message-]");
    if (!(bubble instanceof HTMLElement)) throw new Error("bubble not found");
    await user.click(within(bubble).getByRole("button", { name: "Message actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "React 😂" }));
    const chip = await within(bubble).findByRole("button", { name: "😂 1" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await user.click(chip);
    await waitFor(() =>
      expect(within(bubble).queryByRole("button", { name: "😂 1" })).not.toBeInTheDocument(),
    );
  });

  it("receives a message in realtime and shows it translated", async () => {
    const { log } = await openConversation();
    await asOtherUser("usr_linh", () =>
      mockChatService.sendMessage({
        conversationId: "conv_rafael_linh",
        clientId: "from-linh",
        text: "Em cũng yêu anh",
        media: [],
        replyToId: null,
      }),
    );
    expect(await within(log).findByText("Eu também te amo")).toBeInTheDocument();
    expect(within(log).getByText("Eu também te amo")).toHaveAttribute("lang", "pt-BR");
  });

  it("shows the typing indicator of the other person", async () => {
    await openConversation();
    act(() =>
      publish({
        kind: "typing",
        conversationId: "conv_rafael_linh",
        userId: "usr_linh",
        isTyping: true,
      }),
    );
    expect(await screen.findByRole("status", { name: "typing…" })).toBeInTheDocument();
    act(() =>
      publish({
        kind: "typing",
        conversationId: "conv_rafael_linh",
        userId: "usr_linh",
        isTyping: false,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "typing…" })).not.toBeInTheDocument(),
    );
  });

  it("marks a conversation as read when opened", async () => {
    const user = userEvent.setup();
    signInAs("usr_rafael");
    renderApp("/chats");
    const list = await screen.findByRole("list", { name: "Chats" });
    expect(await within(list).findByLabelText("2 unread messages")).toBeInTheDocument();
    await user.click(within(list).getByRole("link", { name: /Minh Tran/ }));
    await waitFor(() =>
      expect(within(list).queryByLabelText("2 unread messages")).not.toBeInTheDocument(),
    );
  });

  it("filters unread conversations and searches", async () => {
    const user = userEvent.setup();
    signInAs("usr_rafael");
    renderApp("/chats");
    const list = await screen.findByRole("list", { name: "Chats" });
    await within(list).findByText("Linh Pham");
    await user.click(screen.getByRole("radio", { name: "Unread" }));
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([expect.stringContaining("Minh Tran"), expect.stringContaining("Sofía Martínez")]);
    await user.click(screen.getByRole("radio", { name: "All" }));
    await user.type(screen.getByRole("searchbox", { name: "Search conversations" }), "phở");
    expect(within(list).getAllByRole("link")).toHaveLength(1);
  });

  it("keeps drafts per conversation", async () => {
    const user = userEvent.setup();
    const { input } = await openConversation();
    await user.type(input, "rascunho");
    const list = screen.getByRole("list", { name: "Chats" });
    await user.click(within(list).getByRole("link", { name: /Emma Johnson/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(""));
    await user.click(within(list).getByRole("link", { name: /Linh Pham/ }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("rascunho"),
    );
  });

  it("starts a new conversation from the new chat dialog", async () => {
    const user = userEvent.setup();
    signInAs("usr_rafael");
    renderApp("/chats");
    await user.click(await screen.findByRole("button", { name: "New chat" }));
    const dialog = await screen.findByRole("dialog", { name: "New chat" });
    await user.type(within(dialog).getByRole("searchbox"), "ji-soo");
    await user.click(await within(dialog).findByText("Ji-soo Park"));
    expect(await screen.findByText("Say hi to Ji-soo Park 👋")).toBeInTheDocument();
    expect(screen.getByText(/will read it in 한국어/)).toBeInTheDocument();
  });

  it("forwards a message to another chat", async () => {
    const user = userEvent.setup();
    const { log } = await openConversation();
    const bubble = within(log).getByText("Boa noite 🌙").closest("[id^=message-]");
    if (!(bubble instanceof HTMLElement)) throw new Error("bubble not found");
    await user.click(within(bubble).getByRole("button", { name: "Message actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Forward" }));
    const dialog = await screen.findByRole("dialog", { name: "Forward to…" });
    await user.click(within(dialog).getByLabelText("Emma Johnson"));
    await user.click(within(dialog).getByRole("button", { name: "Forward" }));
    expect(await screen.findByText("Message forwarded")).toBeInTheDocument();
  });

  it("shows the conversation not found state", async () => {
    signInAs("usr_rafael");
    renderApp("/chats/conv_linh_jisoo");
    expect(
      await screen.findByText("You are not a member of this conversation."),
    ).toBeInTheDocument();
  });
});
