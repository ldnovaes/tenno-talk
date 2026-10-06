import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { AccountSettings } from "@/features/settings/components/sections/AccountSettings";
import { authService } from "@/services/authService";
import { mockProfileService } from "@/services/mock/implementations/mockProfileService";
import type { AuthProvider } from "@/types/user";
import { caseName, cartesian } from "@/test/combinations";
import { createTestQueryClient, renderWithProviders, signInAs } from "@/test/utils";

/** Settings → Account for every way an account can exist (PLAN.md §30): social, password, both, with or without email. */
async function renderAs(connectedProviders: AuthProvider[], email: string | null) {
  signInAs("usr_rafael");
  const me = await mockProfileService.getMe();
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(profileKeys.me(), { ...me, connectedProviders, email });
  return renderWithProviders(<AccountSettings />, { queryClient });
}

const SOCIAL: AuthProvider[][] = [[], ["google"], ["facebook"], ["google", "facebook"]];

describe("AccountSettings", () => {
  const rows = cartesian({ social: SOCIAL, password: [true, false], email: [true, false] }).filter(
    // Every account signs in somehow; a password account always has an email.
    (row) => (row.password || row.social.length > 0) && (row.email || !row.password),
  );

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", async (_name, row) => {
    const providers: AuthProvider[] = [
      ...row.social,
      ...(row.password ? (["password"] as const) : []),
    ];
    await renderAs(providers, row.email ? "rafael@example.com" : null);

    expect(
      screen.getByText(row.email ? "rafael@example.com" : "No email (signed in with Facebook)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: row.password ? "Change password" : "Set a password" }),
    ).toBeInTheDocument();
    for (const provider of ["Google", "Facebook"] as const) {
      const item = screen.getByText(provider).closest("li, div") as HTMLElement;
      const connected = row.social.includes(provider.toLowerCase() as AuthProvider);
      expect(
        within(item.parentElement ?? item).getByText(connected ? "Connected" : "Not connected"),
      ).toBeInTheDocument();
    }
  });

  it.each([
    [
      "a social-only account sets its first password without a current one",
      [] as AuthProvider[],
      null,
    ],
    ["a password account must give the current one", ["password"] as AuthProvider[], "old-secret"],
  ])("%s", async (_name, providers, current) => {
    const user = userEvent.setup();
    const change = vi.spyOn(authService, "changePassword").mockResolvedValue();
    await renderAs(providers.length ? providers : ["google"], "rafael@example.com");
    await user.click(
      screen.getByRole("button", { name: current ? "Change password" : "Set a password" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Current password") !== null).toBe(current !== null);
    if (current) await user.type(within(dialog).getByLabelText("Current password"), current);
    await user.type(within(dialog).getByLabelText("New password"), "brand-new-pass");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(change).toHaveBeenCalledWith({ current, next: "brand-new-pass" });
    vi.restoreAllMocks();
  });
});
