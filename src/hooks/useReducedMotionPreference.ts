import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(listener: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function useReducedMotionPreference(): boolean {
  // Motion 14 seeds this hook with useState but doesn't subscribe React to updates.
  // Keep its initial fallback and observe native changes for live accessibility.
  const initial = useReducedMotion() ?? false;
  return useSyncExternalStore(subscribe,
    () => typeof window.matchMedia === "function" ? window.matchMedia(query).matches : initial,
    () => true,
  );
}
