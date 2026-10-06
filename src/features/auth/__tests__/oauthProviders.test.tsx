import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authService } from "@/services/authService";
import { mockDb } from "@/services/mock/db";
import { useSessionStore } from "@/stores/sessionStore";
import { renderApp } from "@/test/utils";

describe("social sign-in options", () => {
  afterEach(() => vi.restoreAllMocks());

  it("offers only the providers the server has configured", async () => {
    vi.spyOn(authService, "getOAuthProviders").mockResolvedValue(["google"]);
    renderApp("/welcome");
    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue with Facebook" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue with email" })).toBeInTheDocument();
  });

  it("still allows email when no social login is configured", async () => {
    vi.spyOn(authService, "getOAuthProviders").mockResolvedValue([]);
    renderApp("/welcome");
    expect(await screen.findByRole("link", { name: "Continue with email" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Continue with (Google|Facebook)/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["oauth", "We couldn't sign you in with that account."],
    [
      "oauth_link",
      "An account with this email already exists. Sign in with your email and password instead.",
    ],
  ])("explains a social sign-in sent back with error=%s", async (error, text) => {
    vi.spyOn(authService, "getOAuthProviders").mockResolvedValue(["google"]);
    renderApp(`/welcome?error=${error}`);
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("shows no alert without an error", async () => {
    vi.spyOn(authService, "getOAuthProviders").mockResolvedValue(["google"]);
    renderApp("/welcome?error=unknown");
    await screen.findByRole("button", { name: "Continue with Google" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["Google", true],
    ["Facebook", false],
  ])(
    "signing in with %s starts a new account at the first onboarding step (email: %s)",
    async (name, email) => {
      vi.spyOn(authService, "getOAuthProviders").mockResolvedValue(["google", "facebook"]);
      renderApp("/welcome");
      await userEvent.click(await screen.findByRole("button", { name: `Continue with ${name}` }));
      expect(
        await screen.findByRole("heading", { name: "Welcome to TENNO TALK" }),
      ).toBeInTheDocument();
      const id = useSessionStore.getState().userId ?? "";
      const created = mockDb.read().users[id];
      expect(created?.email !== null).toBe(email);
    },
  );
});
