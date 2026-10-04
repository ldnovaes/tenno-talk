import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

async function createGroup(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  people: string[],
) {
  await user.click(await screen.findByRole("button", { name: "New chat" }));
  const dialog = await screen.findByRole("dialog", { name: "New chat" });
  await user.click(within(dialog).getByRole("tab", { name: "New group" }));
  await user.type(within(dialog).getByLabelText("Group name"), title);
  for (const name of people)
    await user.click(await within(dialog).findByRole("checkbox", { name }));
  await user.click(within(dialog).getByRole("button", { name: "Create group" }));
}

describe("groups", () => {
  beforeEach(() => {
    signInAs("usr_rafael");
    setViewportWidth(1280);
  });

  it("creates a group, shows members and their languages, and adds the Groups filter", async () => {
    const user = userEvent.setup();
    renderApp("/chats");
    await createGroup(user, "Intercâmbio", ["Linh Pham", "Sofía Martínez"]);
    expect(await screen.findByText("3 members")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Group info" }));
    const info = await screen.findByRole("dialog", { name: "Intercâmbio" });
    expect(within(info).getByText("Reads in Tiếng Việt")).toBeInTheDocument();
    expect(within(info).getByText("Reads in Español")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("radio", { name: "Groups" })).toBeInTheDocument();
  });

  it("blocks a second group with a clear message", async () => {
    const user = userEvent.setup();
    renderApp("/chats");
    await createGroup(user, "Primeiro", ["Linh Pham", "Emma Johnson"]);
    await screen.findByText("3 members");
    await createGroup(user, "Segundo", ["Minh Tran", "Yuki Tanaka"]);
    expect(await screen.findByText("You can create only one group.")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        Object.values(mockDb.read().conversations).filter((c) => c.kind === "group"),
      ).toHaveLength(1),
    );
  });

  it("shows sender names and translations in group messages", async () => {
    const user = userEvent.setup();
    renderApp("/chats");
    await createGroup(user, "Trio", ["Linh Pham", "Sofía Martínez"]);
    const input = await screen.findByRole("textbox", { name: "Message" });
    await user.type(input, "Obrigado!{Enter}");
    const log = screen.getByRole("log", { name: "Messages" });
    expect(await within(log).findByText("Obrigado!")).toBeInTheDocument();
    await waitFor(() => {
      const record = Object.values(mockDb.read().messages).find(
        (m) => m.content.type === "text" && m.content.body.text === "Obrigado!",
      );
      expect(record?.translations["vi-VN"]?.text).toBe("Cảm ơn!");
      expect(record?.translations["es-ES"]?.text).toBe("¡Gracias!");
    });
  });
});
