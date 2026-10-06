import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NavigationRail } from "@/layouts/NavigationRail";
import { renderWithProviders } from "@/test/utils";

/**
 * The desktop rail (PLAN.md §6.4). jsdom has no layout, so this checks what the layout depends on: each
 * item keeps its own classes through the tooltip's Slot (`relative` anchors the badge; a className
 * function was once turned into class text there, dropping them all and drawing the badge off-screen),
 * and the current section is marked.
 */
const ITEMS = ["Chats", "Discover", "Feed", "Notifications"] as const;

function renderRail(route: string) {
  renderWithProviders(<NavigationRail me={null} badges={{ chats: 3, notifications: 2 }} />, {
    route,
  });
}

describe("NavigationRail", () => {
  it.each(ITEMS)("%s keeps its classes inside the tooltip trigger", (name) => {
    renderRail("/chats");
    const link = screen.getByRole("link", { name });
    expect(link).toHaveClass("relative", "grid", "size-11");
    expect(link.className).not.toMatch(/=>|isActive/);
  });

  it.each([
    ["/chats/c1", "Chats"],
    ["/discover", "Discover"],
    ["/feed", "Feed"],
    ["/notifications", "Notifications"],
  ] as const)("on %s only %s is the current section", (route, current) => {
    renderRail(route);
    for (const name of ITEMS) {
      const link = screen.getByRole("link", { name });
      if (name === current) expect(link).toHaveAttribute("aria-current", "page");
      else expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("draws each count inside its own icon", () => {
    renderRail("/discover");
    expect(within(screen.getByRole("link", { name: "Chats" })).getByText("3")).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: "Notifications" })).getByText("2"),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: "Feed" })).queryByText(/\d/)).toBeNull();
  });
});
