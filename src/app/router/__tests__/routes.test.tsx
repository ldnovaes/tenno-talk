import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

function renderAt(route: string) {
  signInAs("usr_rafael");
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
    ["/u/linh", "@linh"],
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
    renderAt("/chats/conv_rafael_linh");
    await screen.findByRole("textbox", { name: "Message" });
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });

  it("shows the rail and the two chat panes on desktop", async () => {
    setViewportWidth(1280);
    renderAt("/chats/conv_rafael_linh");
    expect(await screen.findByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Chats" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discover" })).toBeInTheDocument();
  });

  it("opens profile as a side panel above the chats on desktop deep link", async () => {
    setViewportWidth(1280);
    renderAt("/u/linh");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // The background stays rendered (blurred, hidden from assistive tech while the panel is open).
    expect(await screen.findByRole("heading", { name: "Chats", hidden: true })).toBeInTheDocument();
  });
});

describe("overlay deep links", () => {
  it("waits for the current user before rendering the panel content", async () => {
    setViewportWidth(1280);
    signInAs("usr_rafael");
    renderApp("/u/linh");
    expect(await screen.findByRole("heading", { name: "Linh Pham" })).toBeInTheDocument();
  });

  it("does not render overlays for anonymous users", async () => {
    setViewportWidth(1280);
    renderApp("/u/linh");
    expect(await screen.findByRole("heading", { name: /talk to anyone/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
