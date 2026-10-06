import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProfileHeader } from "@/features/profile/components/ProfileHeader";
import { ProfileMenu } from "@/features/profile/components/ProfileMenu";
import { storyKeys } from "@/features/stories/lib/queryKeys";
import type { BlockStatus, UserProfile } from "@/types/user";
import { caseName, cartesian } from "@/test/combinations";
import { createTestQueryClient, renderWithProviders, signInAs } from "@/test/utils";

/**
 * What another person's profile offers, for every combination of block × follow × private × pending request
 * (PLAN.md §9.6, §31.1). Impossible combinations are left out: a pending request exists only towards a private
 * profile you don't follow, and a block removes follows and requests.
 */
function profile(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: "usr_linh",
    username: "linh",
    displayName: "Linh Pham",
    avatarUrl: null,
    bio: "Xin chào",
    country: "VN",
    nativeLanguage: "vi-VN",
    learningLanguages: ["pt-BR"],
    followersCount: 3,
    followingCount: 4,
    postsCount: 5,
    isFollowing: false,
    isPrivate: false,
    followRequestPending: false,
    isOnline: false,
    lastSeenAt: null,
    blockStatus: "none",
    ...overrides,
  };
}

function render(target: UserProfile, isOwn = false) {
  signInAs("usr_rafael");
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(storyKeys.user(target.id), []);
  return renderWithProviders(
    <>
      <ProfileHeader profile={target} isOwn={isOwn} onMessage={() => {}} onEdit={() => {}} />
      {!isOwn && <ProfileMenu profile={target} />}
    </>,
    { queryClient },
  );
}

const rows = cartesian({
  blockStatus: ["none", "blocked_by_me", "blocked_me"] as BlockStatus[],
  isFollowing: [false, true],
  isPrivate: [false, true],
  followRequestPending: [false, true],
}).filter(
  (row) =>
    !(row.followRequestPending && (row.isFollowing || !row.isPrivate)) &&
    !(row.blockStatus !== "none" && (row.isFollowing || row.followRequestPending)),
);

describe("another person's profile (block × following × private × pending)", () => {
  it.each(rows.map((row) => [caseName(row), row] as const))("%s", (_name, row) => {
    render(profile(row));
    const minimal = row.blockStatus === "blocked_me";
    const blocked = row.blockStatus !== "none";

    // Languages and counters: hidden only from someone you were blocked by.
    expect(screen.queryByText("Native") !== null).toBe(!minimal);
    expect(screen.queryByText("Followers") !== null).toBe(!minimal);
    // Follow and Message: only without a block.
    const follow = screen.queryByRole("button", { name: /^(Follow|Following|Requested)$/ });
    expect(follow !== null).toBe(!blocked);
    expect(screen.queryByRole("button", { name: "Message" }) !== null).toBe(!blocked);
    if (follow) {
      const label = row.isFollowing
        ? "Following"
        : row.followRequestPending
          ? "Requested"
          : "Follow";
      expect(follow).toHaveTextContent(label);
      expect(follow).toHaveAttribute(
        "aria-pressed",
        String(row.isFollowing || row.followRequestPending),
      );
    }
    // The menu: nothing at all for someone who blocked you.
    expect(screen.queryByRole("button", { name: "Profile menu" }) !== null).toBe(!minimal);
  });

  it.each([
    ["none", "Block Linh Pham"],
    ["blocked_by_me", "Unblock Linh Pham"],
  ] as [BlockStatus, string][])(
    "with %s the menu offers report and %s",
    async (blockStatus, action) => {
      const user = userEvent.setup();
      render(profile({ blockStatus }));
      await user.click(screen.getByRole("button", { name: "Profile menu" }));
      const menu = await screen.findByRole("menu");
      expect(within(menu).getByRole("menuitem", { name: "Report" })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: action })).toBeInTheDocument();
    },
  );

  it("your own profile offers editing, never follow, message or the menu", () => {
    render(profile({ id: "usr_rafael", username: "rafael", displayName: "Rafael Souza" }), true);
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Profile menu" })).not.toBeInTheDocument();
  });

  it("the bio keeps its author's language and direction", () => {
    render(profile({ bio: "مرحبا", nativeLanguage: "ar" }));
    const bio = screen.getByText("مرحبا");
    expect(bio).toHaveAttribute("lang", "ar");
    expect(bio).toHaveAttribute("dir", "auto");
  });
});
