import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SendRestrictionNotice } from "@/features/chat/components/composer/SendRestrictionNotice";
import { mockDb } from "@/services/mock/db";
import type { SendRestriction } from "@/types/conversation";
import { renderWithProviders, signInAs } from "@/test/utils";

/**
 * Every reason a conversation can't send (PLAN.md §31.1). "unavailable" covers both a block by the other person
 * and "nobody": the same words, so a block is never revealed. Only your own block offers Unblock.
 */
const linh = { id: "usr_linh", username: "linh", displayName: "Linh Pham", avatarUrl: null };

describe("SendRestrictionNotice", () => {
  it.each([
    ["you_blocked", "You blocked Linh Pham", true],
    ["followers_only", "Linh Pham only accepts messages from people they follow", false],
    ["unavailable", "You can't message this person.", false],
  ] as [SendRestriction, string, boolean][])(
    "%s says why; Unblock offered: %s",
    (restriction, text, unblock) => {
      renderWithProviders(<SendRestrictionNotice restriction={restriction} other={linh} />);
      expect(screen.getByRole("status")).toHaveTextContent(text);
      expect(screen.queryByRole("button", { name: "Unblock" }) !== null).toBe(unblock);
    },
  );

  it("Unblock from the conversation lifts your block", async () => {
    signInAs("usr_rafael");
    mockDb.update((db) => {
      db.users["usr_rafael"]?.blockedUserIds.push("usr_linh");
    });
    const user = userEvent.setup();
    renderWithProviders(<SendRestrictionNotice restriction="you_blocked" other={linh} />);
    await user.click(screen.getByRole("button", { name: "Unblock" }));
    await waitFor(() =>
      expect(mockDb.read().users["usr_rafael"]?.blockedUserIds).not.toContain("usr_linh"),
    );
  });

  it("without the other person loaded, it still explains and offers nothing to click", () => {
    renderWithProviders(<SendRestrictionNotice restriction="you_blocked" other={undefined} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
