import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

type SettingsDialog = {
  open: boolean;
  /** «What Jev remembers», opened from Ajustes; it replaces the settings dialog while shown. */
  memory: boolean;
  /** The control that opened the panel; it gets focus back when the panel closes. */
  opener: HTMLElement | null;
};

export const settingsDialogStore = createStore<SettingsDialog>(() => ({ open: false, memory: false, opener: null }));

/** Opens Ajustes from any control: the header gear or a notice that needs a setting. */
export function openSettings(opener: HTMLElement) {
  settingsDialogStore.setState({ open: true, memory: false, opener });
}

/** Closes Ajustes and hands back the control that opened it, if it is still on the page. */
export function closeSettings(): HTMLElement | null {
  const { opener } = settingsDialogStore.getState();
  settingsDialogStore.setState({ open: false, opener: null });
  return opener?.isConnected ? opener : null;
}

/** Swaps Ajustes for the memory panel; closing it returns focus to whatever opened Ajustes. */
export function openMemory() {
  settingsDialogStore.setState({ open: false, memory: true });
}

export function closeMemory(): HTMLElement | null {
  const { opener } = settingsDialogStore.getState();
  settingsDialogStore.setState({ memory: false, opener: null });
  return opener?.isConnected ? opener : null;
}

// Every navigation (links dispatch popstate too) closes the panels, so they never reappear on return.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    const { open, memory } = settingsDialogStore.getState();
    if (open || memory) settingsDialogStore.setState({ open: false, memory: false, opener: null });
  });
}

export function useSettingsOpen(): boolean {
  return useStore(settingsDialogStore, state => state.open);
}

export function useMemoryOpen(): boolean {
  return useStore(settingsDialogStore, state => state.memory);
}
