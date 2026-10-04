import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authService } from "@/services/authService";
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
});
