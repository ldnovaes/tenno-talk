import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "@/services/mock/db";
import { discoverService } from "@/services/discoverService";
import { renderApp, signInAs } from "@/test/utils";

function slides() {
  return within(screen.getByRole("feed", { name: "Posts for you" })).getAllByRole("article");
}

async function openMenu(slide: HTMLElement) {
  const user = userEvent.setup();
  await user.click(within(slide).getByRole("button", { name: "More options" }));
  return user;
}

describe("discover page", () => {
  beforeEach(() => {
    mockDb.reset();
    signInAs("usr_rafael");
  });

  it("shows other people's posts one per screen, never the viewer's own", async () => {
    renderApp("/discover");
    await screen.findByRole("feed", { name: "Posts for you" });
    expect(slides().length).toBeGreaterThan(0);
    expect(screen.queryByRole("article", { name: "Post by Rafael Souza" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Native language" })).not.toBeInTheDocument();
  });

  it("hides a post on 'Not interested' and brings it back with Undo", async () => {
    const hide = vi.spyOn(discoverService, "trackEvents");
    renderApp("/discover");
    await screen.findByRole("feed");
    const first = slides()[0];
    if (!first) throw new Error("no slide");
    const label = first.getAttribute("aria-label") ?? "";
    const count = slides().length;

    const user = await openMenu(first);
    await user.click(await screen.findByRole("menuitem", { name: "Not interested" }));

    await waitFor(() => expect(slides()).toHaveLength(count - 1));
    expect(hide).toHaveBeenCalledWith([expect.objectContaining({ kind: "hide_post" })]);
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(slides()).toHaveLength(count));
    expect(slides()[0]).toHaveAttribute("aria-label", label);
  });

  it("hides every post of an author", async () => {
    renderApp("/discover");
    await screen.findByRole("feed");
    const linh = screen.getAllByRole("article", { name: "Post by Linh Pham" })[0];
    if (!linh) throw new Error("no post by Linh in the first page");
    const user = await openMenu(linh);
    await user.click(await screen.findByRole("menuitem", { name: "Hide posts from @linh" }));
    await waitFor(() =>
      expect(screen.queryByRole("article", { name: "Post by Linh Pham" })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("You won't see posts from @linh here")).toBeInTheDocument();
  });

  it("likes from the slide", async () => {
    renderApp("/discover");
    await screen.findByRole("feed");
    const slide = slides().find((article) =>
      within(article).queryByRole("button", { name: "Like" }),
    );
    if (!slide) throw new Error("every slide is already liked");
    const user = userEvent.setup();
    await user.click(within(slide).getByRole("button", { name: "Like" }));
    expect(await within(slide).findByRole("button", { name: "Unlike" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says when there is nothing to discover", async () => {
    mockDb.update((db) => {
      for (const post of Object.values(db.posts)) {
        db.discover.hiddenPosts.push({ userId: "usr_rafael", postId: post.id });
      }
    });
    renderApp("/discover");
    expect(await screen.findByText("Nothing new right now")).toBeInTheDocument();
  });
});
