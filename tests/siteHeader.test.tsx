// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SiteHeader from "../src/components/SiteHeader";
import { preferencesStore } from "../src/stores/preferencesStore";
import { openSettings, settingsDialogStore } from "../src/stores/settingsDialogStore";
import { diagnosticsStore } from "../src/stores/diagnosticsStore";

vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }), useThemeIconMotion: () => ({ turn: 0, scale: 1 }) }));
afterEach(cleanup);
beforeEach(() => {
  preferencesStore.setState({ language: "es", theme: "light", themePreference: "system", sound: true });
  settingsDialogStore.setState({ open: false, memory: false, opener: null });
  diagnosticsStore.setState({ active: false });
});

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

  it("keeps only theme and the settings gear in the header; sound and language live in Ajustes", () => {
    render(<SiteHeader route="/features" />);
    expect(screen.queryByRole("button", { name: "Sonido de Jev" })).toBeNull();
    expect(screen.queryByRole("button", { name: "English" })).toBeNull();
    expect(screen.getByRole("button", { name: "Tema" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajustes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Capacidades" }).getAttribute("aria-current")).toBe("page");
  });

  it("opens Ajustes from the gear and returns focus to it when closed", async () => {
    render(<SiteHeader route="/" />);
    const gear = screen.getByRole("button", { name: "Ajustes" });
    fireEvent.click(gear);
    const dialog = await screen.findByRole("dialog", { name: "Ajustes" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(gear));
  });

  it("closes Ajustes on navigation and does not reopen it when coming back", async () => {
    const { rerender } = render(<SiteHeader route="/" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    await screen.findByRole("dialog", { name: "Ajustes" });
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    rerender(<SiteHeader route="/about" />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    rerender(<SiteHeader route="/" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("swaps Ajustes for the memory panel and returns focus to the gear when it closes", async () => {
    render(<SiteHeader route="/about" />);
    const gear = screen.getByRole("button", { name: "Ajustes" });
    fireEvent.click(gear);
    fireEvent.click(await screen.findByRole("button", { name: "Memoria" }));
    const memory = await screen.findByRole("dialog", { name: "Lo que Jev recuerda" });
    expect(screen.queryByRole("dialog", { name: "Ajustes" })).toBeNull();
    fireEvent.keyDown(memory, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(gear));
  });

  it("toggles Home's diagnostics from Ajustes only on Home, closing Ajustes", async () => {
    const { rerender } = render(<SiteHeader route="/features" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    await screen.findByRole("dialog", { name: "Ajustes" });
    expect(screen.queryByRole("button", { name: "Diagnóstico" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    rerender(<SiteHeader route="/" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Diagnóstico" }));
    expect(diagnosticsStore.getState().active).toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps each view's name on its link while phones show only the icon", () => {
    render(<SiteHeader route="/" />);
    for (const name of ["Inicio", "Capacidades", "Historia"]) {
      const link = screen.getByRole("link", { name });
      expect(link.querySelector("svg.site-header__icon")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("returns focus to whatever control opened Ajustes, not only the gear", async () => {
    render(<><SiteHeader route="/" /><button type="button">Abrir Ajustes</button></>);
    const opener = screen.getByRole("button", { name: "Abrir Ajustes" });
    act(() => openSettings(opener));
    fireEvent.keyDown(await screen.findByRole("dialog", { name: "Ajustes" }), { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
