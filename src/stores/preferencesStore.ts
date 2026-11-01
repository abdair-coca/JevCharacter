import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

import { readStorage, writeStorage } from "../lib/storage";
import { SPEECH_PLUGINS, type SpeechLanguage, type SpeechPlugin } from "../creature/brain/speechProtocol";
import { DEFAULT_JEV_COLOR, isJevColor, type JevColor } from "../character/jevColors";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";
export type Language = SpeechLanguage;
/** Which plugins the visitor left on; both start on. */
export type PluginSettings = Record<SpeechPlugin, boolean>;
type Preferences = { theme: Theme; themePreference: ThemePreference; language: Language; sound: boolean; jevColor: JevColor; plugins: PluginSettings };
type PreferencesState = Preferences & {
  setThemePreference: (preference: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setSound: (sound: boolean) => void;
  setJevColor: (jevColor: JevColor) => void;
  setPlugin: (plugin: SpeechPlugin, enabled: boolean) => void;
  syncSystemTheme: (dark: boolean) => void;
};

export const DEFAULT_PLUGINS: PluginSettings = { github: true, whatsapp: true };

const isPluginSettings = (value: unknown): value is PluginSettings =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
  SPEECH_PLUGINS.every(plugin => typeof (value as Record<string, unknown>)[plugin] === "boolean");

/** The plugins that are on, in catalog order, as each message sends them. */
export const enabledPlugins = (plugins: PluginSettings): SpeechPlugin[] => SPEECH_PLUGINS.filter(plugin => plugins[plugin]);

export function createPreferencesStore(
  initial: Preferences,
  persist: (key: string, value: unknown) => void = writeStorage,
  systemIsDark: () => boolean = () => window.matchMedia("(prefers-color-scheme: dark)").matches,
) {
  return createStore<PreferencesState>((set, get) => ({
    ...initial,
    setThemePreference: (themePreference) => {
      const theme = themePreference === "system" ? (systemIsDark() ? "dark" : "light") : themePreference;
      persist("jevling.theme", themePreference);
      set({ theme, themePreference });
    },
    setLanguage: (language) => {
      persist("jevling.language", language);
      set({ language });
    },
    setSound: (sound) => {
      persist("jevling.sound", sound);
      set({ sound });
    },
    setJevColor: (jevColor) => {
      persist("jevling.jevColor", jevColor);
      set({ jevColor });
    },
    setPlugin: (plugin, enabled) => {
      const plugins = { ...get().plugins, [plugin]: enabled };
      persist("jevling.plugins", plugins);
      set({ plugins });
    },
    syncSystemTheme: (dark) => {
      if (get().themePreference === "system") set({ theme: dark ? "dark" : "light" });
    },
  }));
}

// The head bootstrap owns first-visit detection; React consumes its validated result.
const root = document.documentElement;
const preference = root.dataset.themePreference;
export const preferencesStore = createPreferencesStore({
  theme: root.dataset.theme === "dark" ? "dark" : "light",
  themePreference: preference === "light" || preference === "dark" ? preference : "system",
  language: root.lang === "en" ? "en" : "es",
  // Jev's voice is on by default; it still waits for the first user gesture.
  sound: readStorage("jevling.sound", true, (value): value is boolean => typeof value === "boolean"),
  jevColor: readStorage("jevling.jevColor", DEFAULT_JEV_COLOR, isJevColor),
  plugins: readStorage("jevling.plugins", DEFAULT_PLUGINS, isPluginSettings),
});

export function usePreferences<T>(selector: (state: PreferencesState) => T): T {
  return useStore(preferencesStore, selector);
}
