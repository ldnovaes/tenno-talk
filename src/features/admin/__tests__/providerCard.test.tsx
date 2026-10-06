import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProviderCard } from "@/features/admin/components/ProviderCard";
import { adminService } from "@/services/adminService";
import type { ProviderState, ProviderStateName } from "@/types/admin";
import { setViewportWidth } from "@/test/setup";
import { renderApp, renderWithProviders, signInAs } from "@/test/utils";

/** The admin's view of each AI provider (PLAN.md §28.3) in every state. */
function provider(state: ProviderStateName, extra: Partial<ProviderState> = {}): ProviderState {
  return {
    provider: "openai",
    model: "gpt-test",
    state,
    until: null,
    lastError: null,
    checkedAt: "2026-10-05T12:00:00.000Z",
    ...extra,
  };
}

describe("ProviderCard", () => {
  it.each([
    ["ok", "Working", false, true, false],
    ["invalid_key", "Key rejected", true, true, true],
    ["cooling_down", "Usage limit reached", true, true, false],
    ["not_configured", "No API key", false, false, true],
  ] as [ProviderStateName, string, boolean, boolean, boolean][])(
    "%s: says %s; shows the error: %s; can be checked: %s; key hint: %s",
    (state, label, error, checkable, hint) => {
      renderWithProviders(
        <ProviderCard
          provider={provider(state, {
            lastError: "openai 401: bad key",
            until: state === "cooling_down" ? "2026-10-05T13:00:00.000Z" : null,
          })}
          primary
          onCheck={() => {}}
          busy={false}
        />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByText("openai 401: bad key") !== null).toBe(error);
      expect(screen.queryByRole("button", { name: "Check now" }) !== null).toBe(checkable);
      expect(screen.queryByText(/Infisical|API key/i, { selector: "p" }) !== null).toBe(hint);
      if (state === "cooling_down") expect(screen.getByText("Back")).toBeInTheDocument();
    },
  );

  it("a check in progress can't be started twice", () => {
    renderWithProviders(
      <ProviderCard provider={provider("invalid_key")} primary onCheck={() => {}} busy />,
    );
    expect(screen.getByRole("button", { name: "Check now" })).toBeDisabled();
  });
});

describe("Admin › AI providers", () => {
  it("Check now asks the server about that provider and shows the answer", async () => {
    setViewportWidth(1280);
    signInAs("usr_rafael");
    const check = vi.spyOn(adminService, "checkProvider");
    const user = userEvent.setup();
    renderApp("/admin/ai");
    const card = (await screen.findByRole("heading", { name: "Anthropic" })).closest("article");
    if (!card) throw new Error("card");
    await user.click(within(card).getByRole("button", { name: "Check now" }));
    await waitFor(() => expect(check).toHaveBeenCalledWith("anthropic"));
    vi.restoreAllMocks();
  });
});
