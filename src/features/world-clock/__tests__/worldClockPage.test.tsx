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
    expect(screen.getByRole("heading", { name: "Vietnã" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /talk to anyone/i })).not.toBeInTheDocument();
  });

  it("writes each card in the language of the other side", async () => {
    renderApp("/time");
    const brazil = await screen.findByRole("region", { name: "Brazil" });
    const vietnam = screen.getByRole("region", { name: "Vietnã" });
    // Brazil is read by the Vietnamese side, Vietnam by the Brazilian side.
    expect(brazil).toHaveAttribute("lang", "vi");
    expect(vietnam).toHaveAttribute("lang", "pt-BR");
    expect(screen.getByLabelText("Giờ tại Brazil: 10:05")).toBeInTheDocument();
    expect(screen.getByLabelText("Horário em Vietnã: 20:05")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Quốc kỳ Brazil" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bandeira do Vietnã" })).toBeInTheDocument();
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
    expect(screen.getByRole("region", { name: "Vietnã" })).toHaveAttribute("data-period", "night");
  });
});
