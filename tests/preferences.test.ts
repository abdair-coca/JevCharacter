// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { createPreferencesStore } from "../src/stores/preferencesStore";

const bootstrap = readFileSync(resolve(process.cwd(), "public/preferences-init.js"), "utf8");
function initialPreferences({ saved = {}, browser = "es-BO", dark = false, blocked = false }:
  { saved?: Record<string, string>; browser?: string; dark?: boolean; blocked?: boolean } = {}) {
  const root = { dataset: {} as Record<string, string>, lang: "" };
  runInNewContext(bootstrap, {
    document: { documentElement: root, querySelector: () => null }, navigator: { language: browser },
    matchMedia: () => ({ matches: dark }),
    localStorage: { getItem: (key: string) => { if (blocked) throw new Error("Denied"); return saved[key] ?? null; } },
  });
  return root;
}

describe("first paint preferences", () => {
  it("applies the saved theme and language before React independently of the system", () => {
    expect(initialPreferences({ saved: { "jevling.theme": '"dark"', "jevling.language": '"es"' }, browser: "en-US" })).toEqual({ dataset: { theme: "dark", themePreference: "dark" }, lang: "es" });
  });
  it("uses system theme and detects English on first visit", () => {
    expect(initialPreferences({ dark: true, browser: "en-GB" })).toEqual({ dataset: { theme: "dark", themePreference: "system" }, lang: "en" });
  });
  it("falls back to Spanish for an unsupported browser language", () => {
    expect(initialPreferences({ browser: "fr-FR" }).lang).toBe("es");
  });
  it("ignores malformed or invalid preferences", () => {
    expect(initialPreferences({ saved: { "jevling.theme": "{bad", "jevling.language": '"fr"' } })).toEqual({ dataset: { theme: "light", themePreference: "system" }, lang: "es" });
  });
  it("still initializes when storage is denied", () => {
    expect(initialPreferences({ blocked: true, dark: true }).dataset.theme).toBe("dark");
  });
});

describe("presentation preferences", () => {
  it("tracks system changes only without a manual override and can return to system mode", () => {
    const persist = vi.fn();
    const store = createPreferencesStore({ theme: "light", themePreference: "system", language: "es" }, persist, () => true);
    store.getState().syncSystemTheme(true);
    expect(store.getState().theme).toBe("dark");
    store.getState().setThemePreference("light");
    store.getState().syncSystemTheme(true);
    expect(store.getState().theme).toBe("light");
    store.getState().setThemePreference("system");
    expect(store.getState().theme).toBe("dark");
    expect(persist.mock.calls).toEqual([["jevling.theme", "light"], ["jevling.theme", "system"]]);
  });
  it("changes language without resetting theme and persists only presentation fields", () => {
    const persist = vi.fn();
    const store = createPreferencesStore({ theme: "dark", themePreference: "dark", language: "es" }, persist);
    store.getState().setLanguage("en");
    expect(store.getState()).toMatchObject({ theme: "dark", themePreference: "dark", language: "en" });
    expect(persist.mock.calls).toEqual([["jevling.language", "en"]]);
  });
  it("keeps manual choices in memory when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Denied"); });
    const store = createPreferencesStore({ theme: "light", themePreference: "system", language: "es" });
    store.getState().setThemePreference("dark");
    store.getState().setLanguage("en");
    expect(store.getState()).toMatchObject({ theme: "dark", language: "en" });
  });
});
