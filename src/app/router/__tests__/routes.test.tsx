import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isOverlayPath } from "@/app/router/overlay";
import { isOnboardingStep, isSettingsSection, paths } from "@/app/router/paths";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

function renderAt(route: string) {
  signInAs("usr_lucas");
  return renderApp(route);
}

describe("AppRoutes", () => {
  it("redirects / to /chats", async () => {
    renderAt("/");
    expect(await screen.findByText("ConversationList")).toBeInTheDocument();
  });

  it.each([
    ["/discover", "Discover"],
    ["/feed", "Feed"],
    ["/notifications", "Notifications"],
    ["/settings", "Settings"],
    ["/settings/appearance", "Appearance"],
    ["/u/cam", "Profile"],
  ])("renders %s", async (route, name) => {
    renderAt(route);
    expect(await screen.findByRole("heading", { name })).toBeInTheDocument();
  });

  it("renders NotFound for unknown routes", async () => {
    renderAt("/does-not-exist");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });

  it("shows the bottom nav on mobile and hides it inside a conversation", async () => {
    setViewportWidth(375);
    const { unmount } = renderAt("/discover");
    expect(await screen.findByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create" })).toBeInTheDocument();
    unmount();
    renderAt("/chats/conv_1");
    await screen.findByText("Conversation");
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });

  it("shows the rail and the two chat panes on desktop", async () => {
    setViewportWidth(1280);
    renderAt("/chats/conv_1");
    expect(await screen.findByText("Conversation")).toBeInTheDocument();
    expect(await screen.findByText("ConversationList")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discover" })).toBeInTheDocument();
  });

  it("opens profile as a side panel above the chats on desktop deep link", async () => {
    setViewportWidth(1280);
    renderAt("/u/cam");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("ConversationList")).toBeInTheDocument();
  });
});

describe("route helpers", () => {
  it("detects overlay paths", () => {
    expect(isOverlayPath("/u/cam")).toBe(true);
    expect(isOverlayPath("/u/cam/edit")).toBe(true);
    expect(isOverlayPath("/settings")).toBe(true);
    expect(isOverlayPath("/settings/privacy")).toBe(true);
    expect(isOverlayPath("/create")).toBe(true);
    expect(isOverlayPath("/stories/usr_cam")).toBe(true);
    expect(isOverlayPath("/chats")).toBe(false);
    expect(isOverlayPath("/discover")).toBe(false);
  });

  it("builds encoded paths", () => {
    expect(paths.conversation("a b")).toBe("/chats/a%20b");
    expect(paths.settings()).toBe("/settings");
    expect(paths.settings("privacy")).toBe("/settings/privacy");
    expect(paths.onboarding()).toBe("/onboarding/welcome");
  });

  it("validates params", () => {
    expect(isSettingsSection("privacy")).toBe(true);
    expect(isSettingsSection("nope")).toBe(false);
    expect(isSettingsSection(undefined)).toBe(false);
    expect(isOnboardingStep("profile")).toBe(true);
    expect(isOnboardingStep("x")).toBe(false);
  });
});
