import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderApp, signInAs } from "@/test/utils";

describe("/time", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 10:05 in São Paulo, 20:05 in Ho Chi Minh City.
    vi.setSystemTime(new Date("2026-10-09T13:05:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("is public: anonymous visitors see both clocks, not the welcome screen", async () => {
    renderApp("/time");
    expect(await screen.findByRole("heading", { name: "Brazil" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vietnam" })).toBeInTheDocument();
    expect(screen.getByLabelText("Time in Brazil: 10:05")).toBeInTheDocument();
    expect(screen.getByLabelText("Time in Vietnam: 20:05")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /talk to anyone/i })).not.toBeInTheDocument();
  });

  it("stays outside the app shell for signed-in users", async () => {
    signInAs("usr_rafael");
    renderApp("/time");
    expect(await screen.findByRole("heading", { name: "Brazil" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });

  it("switches each landscape to the local period of the day", async () => {
    renderApp("/time");
    await screen.findByRole("heading", { name: "Brazil" });
    expect(screen.getByRole("region", { name: "Brazil" })).toHaveAttribute(
      "data-period",
      "morning",
    );
    expect(screen.getByRole("region", { name: "Vietnam" })).toHaveAttribute("data-period", "night");
  });
});
