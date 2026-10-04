import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

function postNamed(name: string): HTMLElement {
  const article = screen.getAllByRole("article", { name: `Post by ${name}` })[0];
  if (!article) throw new Error(`post by ${name} not found`);
  return article;
}

describe("feed", () => {
  beforeEach(() => signInAs("usr_rafael"));

  it("shows posts with captions translated automatically and the original on demand", async () => {
    const user = userEvent.setup();
    renderApp("/feed");
    await screen.findByRole("article", { name: "Post by Linh Pham" });
    const post = postNamed("Linh Pham");
    expect(
      within(post).getByText("O pôr do sol no Lago Oeste hoje estava lindo demais 🌅"),
    ).toHaveAttribute("lang", "pt-BR");
    await user.click(within(post).getByRole("button", { name: "See original" }));
    expect(within(post).getByText("Hoàng hôn ở Hồ Tây hôm nay đẹp quá 🌅")).toHaveAttribute(
      "lang",
      "vi-VN",
    );
  });

  it("shows the original first when auto-translate is off", async () => {
    mockDb.update((db) => {
      const rafael = db.users["usr_rafael"];
      if (rafael) rafael.preferences.translation.autoTranslatePosts = false;
    });
    const user = userEvent.setup();
    renderApp("/feed");
    await screen.findByRole("article", { name: "Post by Linh Pham" });
    const post = postNamed("Linh Pham");
    expect(within(post).getByText("Hoàng hôn ở Hồ Tây hôm nay đẹp quá 🌅")).toBeInTheDocument();
    await user.click(within(post).getByRole("button", { name: "See translation" }));
    expect(
      await within(post).findByText("O pôr do sol no Lago Oeste hoje estava lindo demais 🌅"),
    ).toBeInTheDocument();
  });

  it("likes with an optimistic counter", async () => {
    const user = userEvent.setup();
    renderApp("/feed");
    await screen.findByRole("article", { name: "Post by Sofía Martínez" });
    const post = postNamed("Sofía Martínez");
    await user.click(within(post).getByRole("button", { name: "Like" }));
    expect(within(post).getByRole("button", { name: "Unlike" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(post).getByText("2 likes")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockDb.read().posts["post_sofia_1"]?.likedBy).toContain("usr_rafael"),
    );
  });

  it("likes with a double click on the photo", async () => {
    const user = userEvent.setup();
    renderApp("/feed");
    await screen.findByRole("article", { name: "Post by Sofía Martínez" });
    const post = postNamed("Sofía Martínez");
    await user.dblClick(within(post).getByRole("group", { name: "Photo 1 of 1" }));
    await waitFor(() =>
      expect(mockDb.read().posts["post_sofia_1"]?.likedBy).toContain("usr_rafael"),
    );
  });

  it("opens comments with translations and adds one", async () => {
    const user = userEvent.setup();
    setViewportWidth(1280);
    renderApp("/feed");
    await screen.findByRole("article", { name: "Post by Linh Pham" });
    await user.click(
      within(postNamed("Linh Pham")).getByRole("button", { name: "View all 2 comments" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Comments" });
    expect(await within(dialog).findByText("Lindo mesmo!")).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Add a comment…" }),
      "Saudade daí!",
    );
    await user.click(within(dialog).getByRole("button", { name: "Post" }));
    expect(await within(dialog).findByText("Saudade daí!")).toBeInTheDocument();
  });

  it("creates a post from the desktop dialog and shows it first", async () => {
    const user = userEvent.setup();
    setViewportWidth(1280);
    renderApp("/feed");
    await screen.findByRole("article", { name: "Post by Linh Pham" });
    await user.click(screen.getByRole("link", { name: "Create" }));
    const dialog = await screen.findByRole("dialog", { name: "New post" });
    const file = new File([new Uint8Array([137, 80, 78, 71])], "praia.png", { type: "image/png" });
    await user.upload(within(dialog).getByLabelText("Select photos or videos"), file);
    expect(await within(dialog).findByAltText("praia.png")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Caption"), "Pôr do sol em casa");
    await user.click(within(dialog).getByRole("button", { name: "Share" }));
    expect(await screen.findByText("Posted")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByRole("article")[0]).toHaveAccessibleName("Post by Rafael Souza"),
    );
    expect(screen.getByText("Pôr do sol em casa")).toBeInTheDocument();
  });

  it("shows the profile grid and opens a post", async () => {
    const user = userEvent.setup();
    renderApp("/u/linh");
    const tiles = await screen.findAllByRole("button", { name: "Open post" });
    expect(tiles).toHaveLength(2);
    await user.click(tiles[0] as HTMLElement);
    expect(await screen.findByRole("article", { name: "Post by Linh Pham" })).toBeInTheDocument();
  });
});
