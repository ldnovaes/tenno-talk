import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { useDevicePreferencesStore } from "@/stores/devicePreferencesStore";
import { setPrefersDark } from "@/test/setup";

describe("ThemeProvider", () => {
  it("follows the system preference by default", () => {
    setPrefersDark(true);
    useDevicePreferencesStore.setState({ theme: "system" });
    render(<ThemeProvider>child</ThemeProvider>);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applies explicit light and dark choices", () => {
    setPrefersDark(true);
    useDevicePreferencesStore.setState({ theme: "light" });
    render(<ThemeProvider>child</ThemeProvider>);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    act(() => useDevicePreferencesStore.getState().setTheme("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists the theme choice", () => {
    act(() => useDevicePreferencesStore.getState().setTheme("dark"));
    expect(localStorage.getItem("tenno.device-preferences")).toContain('"theme":"dark"');
  });
});
