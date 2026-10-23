import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

/** Home's live-signal panel; toggled from Ajustes or the `d` key, shown only while Home converses. */
export const diagnosticsStore = createStore<{ active: boolean }>(() => ({ active: false }));

export function setDiagnostics(active: boolean) {
  diagnosticsStore.setState({ active });
}

export function toggleDiagnostics() {
  diagnosticsStore.setState(state => ({ active: !state.active }));
}

export function useDiagnosticsActive(): boolean {
  return useStore(diagnosticsStore, state => state.active);
}
