import { useCallback, useSyncExternalStore } from "react";

/** Live result of a CSS media query; false where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((listener: () => void) => {
    if (typeof window.matchMedia !== "function") return () => {};
    const media = window.matchMedia(query);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return useSyncExternalStore(subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}
