import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PushPrompt } from "@/features/notifications/components/PushPrompt";
import { PushSettings } from "@/features/notifications/components/PushSettings";
import { useDevicePreferencesStore } from "@/stores/devicePreferencesStore";
import { stubPush } from "@/test/push";
import { renderWithProviders } from "@/test/utils";

/** Web Push on this device (PLAN.md §36.2), in every state the browser and the server can be in. */
afterEach(() => vi.restoreAllMocks());

const enableButton = () => screen.findByRole("button", { name: /push notifications/ });

describe("PushSettings", () => {
  it.each([
    ["the browser has no Web Push", { supported: false }, "Enable", true, null],
    [
      "the server has no keys",
      { enabled: false },
      "Enable",
      true,
      "Push notifications are not available yet.",
    ],
    [
      "the browser blocked notifications",
      { permission: "denied" as const },
      "Enable",
      true,
      "Notifications are blocked",
    ],
    ["it was never asked", {}, "Enable", false, null],
    ["this device is subscribed", { subscribed: true }, "Disable", false, null],
    [
      "subscribed, though blocked since (can still turn it off)",
      { subscribed: true, permission: "denied" as const },
      "Disable",
      false,
      null,
    ],
  ])("%s", async (_name, state, action, disabled, note) => {
    stubPush(state);
    renderWithProviders(<PushSettings />);
    const button = await enableButton();
    await waitFor(() => expect(button).toHaveTextContent(`${action} push notifications`));
    expect(button).toHaveProperty("disabled", disabled);
    if (note) expect(screen.getByText(new RegExp(note))).toBeInTheDocument();
  });

  it("turning it on subscribes with the server's key; turning it off unsubscribes", async () => {
    const user = userEvent.setup();
    const { enable, disable } = stubPush({});
    renderWithProviders(<PushSettings />);
    await user.click(await screen.findByRole("button", { name: "Enable push notifications" }));
    expect(enable).toHaveBeenCalledWith("public-key");
    await user.click(await screen.findByRole("button", { name: "Disable push notifications" }));
    expect(disable).toHaveBeenCalled();
  });
});

describe("PushPrompt", () => {
  it("asks only on a tap, then disappears once subscribed", async () => {
    const user = userEvent.setup();
    const { enable } = stubPush({});
    renderWithProviders(<PushPrompt />);
    await screen.findByRole("heading", { name: "Turn on notifications" });
    expect(enable).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(enable).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Turn on notifications" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("on iPhone/iPad in a tab, explains the Home Screen step and offers no button that can't work", async () => {
    stubPush({ supported: false, needsInstall: true });
    renderWithProviders(<PushPrompt />);
    expect(await screen.findByText(/add TENNO TALK to your Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument();
  });

  it("Not now hides it for 30 days on this device", async () => {
    const user = userEvent.setup();
    stubPush({});
    renderWithProviders(<PushPrompt />);
    await user.click(await screen.findByRole("button", { name: "Not now" }));
    expect(
      screen.queryByRole("heading", { name: "Turn on notifications" }),
    ).not.toBeInTheDocument();
    expect(useDevicePreferencesStore.getState().pushPromptDismissedAt).not.toBeNull();
  });

  it.each([
    ["denied", { permission: "denied" as const }],
    ["no server keys", { enabled: false }],
    ["already subscribed", { subscribed: true }],
  ])("stays away when %s", async (_name, state) => {
    stubPush(state);
    renderWithProviders(<PushPrompt />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      screen.queryByRole("heading", { name: "Turn on notifications" }),
    ).not.toBeInTheDocument();
  });
});
