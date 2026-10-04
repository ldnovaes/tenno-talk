import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderApp } from "@/test/utils";

/** The way between sign-in and sign-up must be a real, clickable link with its text inside. */
describe("links between sign-in and sign-up", () => {
  it("sign-in offers a link to create an account", async () => {
    renderApp("/signin");
    const link = await screen.findByRole("link", { name: "Create one" });
    expect(link).toHaveAttribute("href", "/signup");
  });

  it("sign-up offers a link back to sign in", async () => {
    renderApp("/signup");
    const link = await screen.findByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/signin");
  });
});
