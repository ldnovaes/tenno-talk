import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

/** Comments on a post (PLAN.md §9.7, §31.1): a refusal explains itself; a link opens one comment. */
beforeEach(() => setViewportWidth(1280));

describe("commenting where the author doesn't allow it", () => {
  it("says why, once, next to the box, and keeps what was written", async () => {
    mockDb.update((db) => {
      const rafael = db.users["usr_rafael"];
      if (rafael) rafael.preferences.privacy.whoCanComment = "nobody";
    });
    signInAs("usr_emma");
    const user = userEvent.setup();
    renderApp("/posts/post_rafael_1");
    const box = await screen.findByRole("textbox", { name: /comment/i });
    await user.type(box, "Que lindo!");
    const form = box.closest("form");
    if (!form) throw new Error("form");
    await user.click(within(form).getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Comments are limited on this post.",
    );
    expect(screen.getAllByText("Comments are limited on this post.")).toHaveLength(1);
    expect(screen.queryByText("Something went wrong.")).not.toBeInTheDocument();
    expect(box).toHaveValue("Que lindo!");
  });
});

describe("a link to one comment (the notification's destination)", () => {
  it("shows that comment even when it is beyond the first page", async () => {
    mockDb.update((db) => {
      const start = Date.parse("2026-10-01T00:00:00.000Z");
      for (let n = 0; n < 70; n++) {
        const id = `cmt_many_${String(n).padStart(2, "0")}`;
        db.comments[id] = {
          id,
          postId: "post_rafael_1",
          authorId: "usr_linh",
          body: { text: `Comentário ${n}`, language: "pt-BR" },
          translations: {},
          createdAt: new Date(start + n * 60_000).toISOString(),
        };
      }
    });
    signInAs("usr_rafael");
    renderApp("/posts/post_rafael_1?commentId=cmt_many_65");
    const target = await screen.findByText("Comentário 65");
    expect(target.closest("li")).toHaveAttribute("id", "comment-item-cmt_many_65");
    await waitFor(() => expect(screen.getAllByText(/^Comentário \d+$/).length).toBeGreaterThan(1));
    const list = target.closest("ul");
    if (!list) throw new Error("list");
    expect(within(list).getAllByText("Comentário 65")).toHaveLength(1);
  });
});
