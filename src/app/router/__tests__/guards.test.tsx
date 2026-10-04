import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockAuthService } from "@/services/mock/implementations/mockAuthService";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

describe("route guards", () => {
  it("sends anonymous users to the welcome screen", async () => {
    renderApp("/chats");
    expect(await screen.findByRole("heading", { name: /talk to anyone/i })).toBeInTheDocument();
  });

  it("keeps the legal pages public", async () => {
    renderApp("/terms");
    expect(await screen.findByRole("heading", { name: "Terms of Use" })).toBeInTheDocument();
    expect(screen.getByText(/OpenAI \(ChatGPT\) and Anthropic \(Claude\)/)).toBeInTheDocument();
  });

  it("sends signed-in users that did not finish onboarding to the first step", async () => {
    await mockAuthService.signUp({ email: "new@example.com", password: "secret123" });
    renderApp("/chats");
    expect(
      await screen.findByRole("heading", { name: "Welcome to TENNO TALK" }),
    ).toBeInTheDocument();
  });

  it("does not let users skip onboarding steps", async () => {
    await mockAuthService.signUp({ email: "new@example.com", password: "secret123" });
    renderApp("/onboarding/profile");
    expect(
      await screen.findByRole("heading", { name: "Welcome to TENNO TALK" }),
    ).toBeInTheDocument();
  });

  it("redirects onboarded users away from the welcome screen", async () => {
    signInAs("usr_linh");
    renderApp("/welcome");
    expect(await screen.findByRole("heading", { name: "Chats" })).toBeInTheDocument();
  });

  it("signs in with a demo account from the welcome screen", async () => {
    renderApp("/welcome");
    await userEvent.click(await screen.findByRole("button", { name: "Sign in as Linh" }));
    expect(await screen.findByRole("heading", { name: "Chats" })).toBeInTheDocument();
  });

  it("signs out and clears the session", async () => {
    setViewportWidth(375);
    signInAs("usr_linh");
    renderApp("/settings");
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: /talk to anyone/i })).toBeInTheDocument();
    expect(localStorage.getItem("tenno.mock-session")).toBeNull();
  });
});
