import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

type SettingsDialog = {
  open: boolean;
  /** The control that opened the panel; it gets focus back when the panel closes. */
  opener: HTMLElement | null;
};

export const settingsDialogStore = createStore<SettingsDialog>(() => ({ open: false, opener: null }));

/** Opens Ajustes from any control: the header gear or a notice that needs a setting. */
export function openSettings(opener: HTMLElement) {
  settingsDialogStore.setState({ open: true, opener });
}

/** Closes Ajustes and hands back the control that opened it, if it is still on the page. */
export function closeSettings(): HTMLElement | null {
  const { opener } = settingsDialogStore.getState();
  settingsDialogStore.setState({ open: false, opener: null });
  return opener?.isConnected ? opener : null;
}

// Every navigation (links dispatch popstate too) closes the panel, so it never reappears on return.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (settingsDialogStore.getState().open) settingsDialogStore.setState({ open: false, opener: null });
  });
}

export function useSettingsOpen(): boolean {
  return useStore(settingsDialogStore, state => state.open);
}
