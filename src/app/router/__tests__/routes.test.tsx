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
    expect(await screen.findByRole("heading", { name: "Chats" })).toBeInTheDocument();
  });

  it.each([
    ["/discover", "Discover"],
    ["/feed", "Feed"],
    ["/notifications", "Notifications"],
    ["/settings", "Settings"],
    ["/settings/appearance", "Appearance"],
    ["/u/cam", "@cam"],
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
    renderAt("/chats/conv_lucas_cam");
    await screen.findByRole("textbox", { name: "Message" });
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });

  it("shows the rail and the two chat panes on desktop", async () => {
    setViewportWidth(1280);
    renderAt("/chats/conv_lucas_cam");
    expect(await screen.findByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Chats" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discover" })).toBeInTheDocument();
  });

  it("opens profile as a side panel above the chats on desktop deep link", async () => {
    setViewportWidth(1280);
    renderAt("/u/cam");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // The background stays rendered (blurred, hidden from assistive tech while the panel is open).
    expect(await screen.findByRole("heading", { name: "Chats", hidden: true })).toBeInTheDocument();
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

describe("overlay deep links", () => {
  it("waits for the current user before rendering the panel content", async () => {
    setViewportWidth(1280);
    signInAs("usr_lucas");
    renderApp("/u/cam");
    expect(await screen.findByRole("heading", { name: "Cam Nguyen" })).toBeInTheDocument();
  });

  it("does not render overlays for anonymous users", async () => {
    setViewportWidth(1280);
    renderApp("/u/cam");
    expect(await screen.findByRole("heading", { name: /talk to anyone/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
