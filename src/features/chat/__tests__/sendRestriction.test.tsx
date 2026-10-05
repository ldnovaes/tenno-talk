import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { renderApp, signInAs } from "@/test/utils";

/** The conversation says why it can't send instead of failing in silence (PLAN.md §31.1). */
describe("a conversation that can't send", () => {
  beforeEach(() => signInAs("usr_rafael"));

  it('explains a "People I follow" rule', async () => {
    mockDb.update((db) => {
      const linh = db.users["usr_linh"];
      if (linh) linh.preferences.privacy.whoCanMessage = "followers";
      db.follows = db.follows.filter(
        (f) => !(f.followerId === "usr_linh" && f.followeeId === "usr_rafael"),
      );
    });
    renderApp("/chats/conv_rafael_linh");
    expect(
      await screen.findByText("Linh Pham only accepts messages from people they follow."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("says nothing about a block when the other person blocked me", async () => {
    mockDb.update((db) => {
      db.users["usr_linh"]?.blockedUserIds.push("usr_rafael");
    });
    renderApp("/chats/conv_rafael_linh");
    expect(await screen.findByText("You can't message this person.")).toBeInTheDocument();
    expect(screen.queryByText(/blocked/i)).not.toBeInTheDocument();
  });
});
