import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

/**
 * A privacy choice made in Settings shows on the other person's screen (PLAN.md §31.1): Rafael changes it through
 * the UI, then someone else looks. One row per value and surface; every combination is in PrivacyMatrixIT and
 * privacyMatrix.test.ts.
 */
beforeEach(() => setViewportWidth(1280));

async function rafaelChooses(label: string, option: string) {
  const user = userEvent.setup();
  signInAs("usr_rafael");
  renderApp("/settings/privacy");
  await user.click(await screen.findByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: label })).toHaveTextContent(option),
  );
  cleanup();
}

describe("Who can message me, seen by Emma (Rafael doesn't follow her)", () => {
  it.each([
    ["Everyone", null],
    ["People I follow", "Rafael Souza only accepts messages from people they follow."],
    ["Nobody", "You can't message this person."],
  ])("%s", async (option, notice) => {
    await rafaelChooses("Who can message me", option);
    signInAs("usr_emma");
    renderApp("/chats/conv_rafael_emma");
    await screen.findByRole("log", { name: "Messages" });
    if (notice) {
      expect(await screen.findByRole("status")).toHaveTextContent(notice);
      expect(screen.queryByRole("textbox", { name: /message/i })).not.toBeInTheDocument();
    } else {
      expect(await screen.findByRole("textbox", { name: /message/i })).toBeInTheDocument();
    }
  });
});

describe("Who can see when I'm online, seen by Linh (Rafael follows her)", () => {
  beforeEach(() => {
    mockDb.update((db) => {
      const rafael = db.users["usr_rafael"];
      if (rafael) rafael.lastSeenAt = new Date(Date.now() - 20 * 60_000).toISOString();
    });
  });

  it.each([
    ["Everyone", true],
    ["People I follow", true],
    ["Nobody", false],
  ])("%s → last seen shown: %s", async (option, shown) => {
    await rafaelChooses("Who can see when I'm online", option);
    signInAs("usr_linh");
    renderApp("/chats/conv_rafael_linh");
    await screen.findByRole("log", { name: "Messages" });
    const profileLink = await screen.findByRole("button", { name: /Rafael Souza/ });
    const header = profileLink.closest("header") ?? document.body;
    expect(within(header).queryByText(/last seen|online/i) !== null).toBe(shown);
  });
});

describe("Profile visibility, seen by Mei (a stranger)", () => {
  it("private: posts give way to the private notice", async () => {
    await rafaelChooses("Profile visibility", "Private");
    signInAs("usr_mei");
    renderApp("/u/rafael");
    expect(await screen.findByText("This account is private")).toBeInTheDocument();
  });

  it("public: no notice", async () => {
    signInAs("usr_mei");
    renderApp("/u/rafael");
    await screen.findByRole("heading", { name: "Rafael Souza" });
    expect(screen.queryByText("This account is private")).not.toBeInTheDocument();
  });
});
