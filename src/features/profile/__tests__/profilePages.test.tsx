import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

describe("profile", () => {
  beforeEach(() => signInAs("usr_lucas"));

  it("shows another person's profile with languages and stats", async () => {
    renderApp("/u/cam");
    expect(await screen.findByRole("heading", { name: "Cam Nguyen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "@cam" })).toBeInTheDocument();
    expect(screen.getByText("Tiếng Việt")).toHaveAttribute("lang", "vi-VN");
    expect(screen.getByText("Vietnam")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Message" })).toBeInTheDocument();
  });

  it("follows and unfollows with live counters", async () => {
    const user = userEvent.setup();
    renderApp("/u/emma");
    const follow = await screen.findByRole("button", { name: "Follow" });
    const followers = () => screen.getByText("Followers").previousElementSibling?.textContent;
    const before = Number(followers());
    await user.click(follow);
    expect(await screen.findByRole("button", { name: "Following" })).toBeInTheDocument();
    expect(Number(followers())).toBe(before + 1);
    await waitFor(() =>
      expect(
        mockDb
          .read()
          .follows.some((f) => f.followerId === "usr_lucas" && f.followeeId === "usr_emma"),
      ).toBe(true),
    );
  });

  it("opens the conversation from Message", async () => {
    const user = userEvent.setup();
    renderApp("/u/cam");
    await user.click(await screen.findByRole("button", { name: "Message" }));
    expect(await screen.findByRole("log", { name: "Messages" })).toBeInTheDocument();
  });

  it("shows the own profile with Edit profile", async () => {
    renderApp("/u/lucas");
    expect(await screen.findByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
    expect(screen.getByText("Share your first moment.")).toBeInTheDocument();
  });

  it("shows a not found state", async () => {
    renderApp("/u/ghost_user");
    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });

  it("blocks someone after confirmation", async () => {
    const user = userEvent.setup();
    renderApp("/u/omar");
    await user.click(await screen.findByRole("button", { name: "Profile menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Block Omar Haddad" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Block Omar Haddad" }));
    await waitFor(() =>
      expect(mockDb.read().users["usr_lucas"]?.blockedUserIds).toContain("usr_omar"),
    );
    expect(await screen.findByText("Omar Haddad was blocked")).toBeInTheDocument();
  });

  it("edits the profile, including languages", async () => {
    const user = userEvent.setup();
    setViewportWidth(375);
    renderApp("/u/lucas/edit");
    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Lucas A.");
    await user.click(screen.getByRole("button", { name: "Remove English (US)" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "Lucas A." })).toBeInTheDocument();
    const saved = mockDb.read().users["usr_lucas"];
    expect(saved?.displayName).toBe("Lucas A.");
    expect(saved?.learningLanguages).toEqual(["vi-VN"]);
  });

  it("validates the username when editing", async () => {
    const user = userEvent.setup();
    renderApp("/u/lucas/edit");
    const username = await screen.findByLabelText("Username");
    await user.clear(username);
    await user.type(username, "cam");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This username is already taken.")).toBeInTheDocument();
  });

  it("does not let you edit someone else's profile", async () => {
    renderApp("/u/cam/edit");
    expect(await screen.findByRole("button", { name: "Edit profile" })).toBeInTheDocument();
  });
});
