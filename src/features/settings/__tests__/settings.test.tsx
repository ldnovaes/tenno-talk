import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { useDevicePreferencesStore } from "@/stores/devicePreferencesStore";
import { renderApp, signInAs } from "@/test/utils";

describe("settings", () => {
  beforeEach(() => signInAs("usr_lucas"));

  it("lists every section and navigates into one", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    for (const name of [
      "Account",
      "Language",
      "Translation",
      "Appearance",
      "Privacy",
      "Notifications",
    ]) {
      expect(await screen.findByRole("button", { name: new RegExp(name) })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: /Privacy/ }));
    expect(await screen.findByRole("heading", { name: "Privacy" })).toBeInTheDocument();
  });

  it("switches the theme from Appearance", async () => {
    const user = userEvent.setup();
    renderApp("/settings/appearance");
    await user.click(await screen.findByRole("radio", { name: "Dark" }));
    expect(useDevicePreferencesStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("changes privacy rules and persists them", async () => {
    const user = userEvent.setup();
    renderApp("/settings/privacy");
    await user.click(await screen.findByRole("combobox", { name: "Who can message me" }));
    await user.click(await screen.findByRole("option", { name: "People I follow" }));
    await waitFor(() =>
      expect(mockDb.read().users["usr_lucas"]?.preferences.privacy.whoCanMessage).toBe("followers"),
    );
  });

  it("lists and unblocks blocked users", async () => {
    mockDb.update((db) => {
      db.users["usr_lucas"]?.blockedUserIds.push("usr_mei");
    });
    const user = userEvent.setup();
    renderApp("/settings/privacy");
    expect(await screen.findByText("Mei Chen")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unblock" }));
    expect(await screen.findByText("You haven't blocked anyone.")).toBeInTheDocument();
  });

  it("toggles notification preferences", async () => {
    const user = userEvent.setup();
    renderApp("/settings/notifications");
    await user.click(await screen.findByRole("switch", { name: "Likes" }));
    await waitFor(() =>
      expect(mockDb.read().users["usr_lucas"]?.preferences.notifications.likes).toBe(false),
    );
  });

  it("changes the receiving language", async () => {
    const user = userEvent.setup();
    renderApp("/settings/language");
    await user.click(await screen.findByRole("combobox", { name: "Receive messages in" }));
    await user.click(await screen.findByRole("option", { name: /English \(US\)/ }));
    await waitFor(() =>
      expect(mockDb.read().users["usr_lucas"]?.preferences.translation.receivingLanguage).toBe(
        "en-US",
      ),
    );
  });

  it("changes the password after checking the current one", async () => {
    const user = userEvent.setup();
    renderApp("/settings/account");
    await user.click(await screen.findByRole("button", { name: "Change password" }));
    const dialog = await screen.findByRole("dialog", { name: "Change password" });
    await user.type(within(dialog).getByLabelText("Current password"), "wrong");
    await user.type(within(dialog).getByLabelText("New password"), "newsecret1");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("Your current password is not correct."),
    ).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Current password"));
    await user.type(within(dialog).getByLabelText("Current password"), "demo1234");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(mockDb.read().users["usr_lucas"]?.password).toBe("newsecret1");
  });

  it("shows connected accounts and accepted terms", async () => {
    renderApp("/settings/account");
    expect(await screen.findByText("Terms accepted (version 2026-10-03)")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Facebook")).toBeInTheDocument();
  });

  it("deletes the account (LGPD) and signs out", async () => {
    const user = userEvent.setup();
    renderApp("/settings/account");
    await user.click(await screen.findByRole("button", { name: "Delete account" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete account" }));
    expect(await screen.findByRole("heading", { name: /talk to anyone/i })).toBeInTheDocument();
    expect(mockDb.read().users["usr_lucas"]).toBeUndefined();
    expect(Object.keys(mockDb.read().conversations).some((id) => id.includes("lucas"))).toBe(false);
  });
});
