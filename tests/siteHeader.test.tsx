// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SiteHeader from "../src/components/SiteHeader";
import { preferencesStore } from "../src/stores/preferencesStore";

vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }), useThemeIconMotion: () => ({ turn: 0, scale: 1 }) }));
afterEach(cleanup);
beforeEach(() => preferencesStore.setState({ language: "es", theme: "light", themePreference: "system" }));

describe("header preference controls", () => {
  it("keeps automatic system selection until the user toggles the resolved theme", () => {
    render(<SiteHeader route="/" />);
    expect(screen.queryByRole("combobox")).toBeNull();
    const button = screen.getByRole("button", { name: "Tema" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    act(() => preferencesStore.getState().syncSystemTheme(true));
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(preferencesStore.getState().themePreference).toBe("system");
    fireEvent.click(button);
    expect(preferencesStore.getState()).toMatchObject({ theme: "light", themePreference: "light" });
    act(() => preferencesStore.getState().syncSystemTheme(true));
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(preferencesStore.getState()).toMatchObject({ theme: "dark", themePreference: "dark" });
  });

  it("keeps both language choices visible and updates accessible selection without changing theme", () => {
    render(<SiteHeader route="/features" />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Español" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Features" }).getAttribute("aria-current")).toBe("page");
    expect(preferencesStore.getState().themePreference).toBe("system");
  });
});
