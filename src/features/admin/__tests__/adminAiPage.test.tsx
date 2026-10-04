import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderApp, signInAs } from "@/test/utils";

describe("AI providers page", () => {
  it("shows both providers in priority order and the queue to admins", async () => {
    signInAs("usr_rafael");
    renderApp("/admin/ai");
    const names = await screen.findAllByRole("heading", { level: 2 });
    expect(names.map((heading) => heading.textContent)).toEqual([
      "ChatGPT",
      "Claude",
      "Translation queue",
    ]);
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Fallback")).toBeInTheDocument();
    expect(screen.getAllByText("Working")).toHaveLength(2);
    expect(screen.getByText("Waiting for a provider")).toBeInTheDocument();
  });

  it("is closed to everyone else", async () => {
    signInAs("usr_linh");
    renderApp("/admin/ai");
    expect(await screen.findByText("This page is for administrators.")).toBeInTheDocument();
    expect(screen.queryByText("ChatGPT")).not.toBeInTheDocument();
  });

  it("is reachable from settings by admins only", async () => {
    const user = userEvent.setup();
    signInAs("usr_rafael");
    renderApp("/settings");
    await user.click(await screen.findByRole("button", { name: "AI providers" }));
    expect(await screen.findByRole("heading", { name: "ChatGPT" })).toBeInTheDocument();
  });
});
