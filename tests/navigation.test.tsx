// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { savedScroll } from "../src/navigation/routes";
import { preferencesStore } from "../src/stores/preferencesStore";

vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }), useThemeIconMotion: () => ({ turn: 0, scale: 1 }) }));
vi.mock("../src/pages/HomePage", () => ({ default: () => <main><h1 data-page-route="/" tabIndex={-1}>Inicio</h1></main> }));
vi.mock("../src/pages/FeaturesPage", () => ({ default: () => <main><h1 data-page-route="/features" tabIndex={-1}>Capacidades</h1></main> }));
vi.mock("../src/pages/AboutPage", () => ({ default: () => <main><h1 data-page-route="/about" tabIndex={-1}>Historia</h1></main> }));

let scrollY = 0;
beforeEach(() => {
  scrollY = 0;
  window.history.replaceState(null, "", "/features");
  preferencesStore.setState({ language: "es", theme: "light", themePreference: "system", sound: false });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
  vi.stubGlobal("scrollTo", vi.fn((_x: number, y: number) => { scrollY = y; }));
});
afterEach(cleanup);

describe("route history and scroll", () => {
  it("saves the position on leave, starts a new visit at the top and restores it on back", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Capacidades" });
    expect(window.history.scrollRestoration).toBe("manual");
    scrollY = 640;
    fireEvent.click(screen.getByRole("link", { name: "Historia" }));
    const about = await screen.findByRole("heading", { name: "Historia" });
    await waitFor(() => expect(document.activeElement).toBe(about));
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
    expect(savedScroll()).toBe(0);
    window.history.back();
    const features = await screen.findByRole("heading", { name: "Capacidades" });
    await waitFor(() => expect(window.scrollTo).toHaveBeenLastCalledWith(0, 640));
    expect(document.activeElement).toBe(features);
    expect(scrollY).toBe(640);
  });

  it("restores a reloaded entry without moving focus", async () => {
    window.history.replaceState({ scrollY: 320 }, "", "/about");
    render(<App />);
    await screen.findByRole("heading", { name: "Historia" });
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 320));
    expect(document.activeElement).toBe(document.body);
  });

  it("ignores missing or invalid saved positions", () => {
    window.history.replaceState({ scrollY: "far" }, "", "/about");
    expect(savedScroll()).toBe(0);
    window.history.replaceState({ scrollY: -5 }, "", "/about");
    expect(savedScroll()).toBe(0);
    window.history.replaceState(null, "", "/about");
    expect(savedScroll()).toBe(0);
  });
});
