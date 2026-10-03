import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDiscoverService } from "@/services/mock/implementations/mockDiscoverService";
import { mockDb } from "@/services/mock/db";
import { writeMockSession } from "@/services/mock/session";
import { renderApp, signInAs } from "@/test/utils";

describe("discover service", () => {
  beforeEach(() => writeMockSession("usr_lucas"));

  it("pages through everyone except the viewer, best matches first", async () => {
    const first = await mockDiscoverService.getPeople({ nativeLanguage: null }, null);
    expect(first.items).toHaveLength(6);
    // People learning Portuguese come first for a Brazilian viewer.
    expect(first.items[0]?.learningLanguages.some((l) => l.startsWith("pt"))).toBe(true);
    const second = await mockDiscoverService.getPeople({ nativeLanguage: null }, first.nextCursor);
    const ids = [...first.items, ...second.items].map((p) => p.id);
    expect(ids).not.toContain("usr_lucas");
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.nextCursor).toBeNull();
  });

  it("filters by native language (any regional variant)", async () => {
    const page = await mockDiscoverService.getPeople({ nativeLanguage: "vi-VN" }, null);
    expect(page.items.map((p) => p.id).sort()).toEqual(["usr_cam", "usr_minh"]);
  });

  it("hides people blocked in either direction", async () => {
    mockDb.update((db) => {
      db.users["usr_lucas"]?.blockedUserIds.push("usr_cam");
      db.users["usr_minh"]?.blockedUserIds.push("usr_lucas");
    });
    const page = await mockDiscoverService.getPeople({ nativeLanguage: "vi-VN" }, null);
    expect(page.items).toEqual([]);
  });
});

describe("discover page", () => {
  beforeEach(() => signInAs("usr_lucas"));

  it("shows people cards with languages and actions", async () => {
    renderApp("/discover");
    const card = (await screen.findByText("Sofía Martínez")).closest("article");
    if (!(card instanceof HTMLElement)) throw new Error("card not found");
    expect(within(card).getByText("Español")).toHaveAttribute("lang", "es-ES");
    expect(within(card).getByText("Spain")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Message" })).toBeInTheDocument();
  });

  it("filters by native language", async () => {
    const user = userEvent.setup();
    renderApp("/discover");
    await screen.findByText("Sofía Martínez");
    await user.click(screen.getByRole("combobox", { name: "Native language" }));
    await user.click(await screen.findByRole("option", { name: /Tiếng Việt/ }));
    await waitFor(() => expect(screen.queryByText("Sofía Martínez")).not.toBeInTheDocument());
    expect(screen.getByText("Cam Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Minh Tran")).toBeInTheDocument();
  });

  it("starts a conversation from a card", async () => {
    const user = userEvent.setup();
    renderApp("/discover");
    const card = (await screen.findByText("Arjun Mehta")).closest("article");
    if (!(card instanceof HTMLElement)) throw new Error("card not found");
    await user.click(within(card).getByRole("button", { name: "Message" }));
    expect(await screen.findByText("Say hi to Arjun Mehta 👋")).toBeInTheDocument();
  });
});
