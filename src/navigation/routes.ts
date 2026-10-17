import { useSyncExternalStore, type MouseEvent } from "react";

export type Route = "/" | "/features" | "/about";
export type PageRoute = Route | "not-found";
function currentRoute(): PageRoute {
  const path = window.location.pathname;
  return path === "/" || path === "/features" || path === "/about" ? path : "not-found";
}
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
export function useRoute(): PageRoute {
  return useSyncExternalStore(subscribe, currentRoute);
}
/** Stores the current scroll position in the current history entry. */
export function rememberScroll() {
  const state: unknown = window.history.state;
  window.history.replaceState({ ...(typeof state === "object" ? state : null), scrollY: Math.round(window.scrollY) }, "");
}
/** Scroll position saved for the current entry: back/forward and reload return there. */
export function savedScroll(): number {
  const state: unknown = window.history.state;
  const value = typeof state === "object" && state !== null && "scrollY" in state ? state.scrollY : 0;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
export function navigate(event: MouseEvent<HTMLAnchorElement>, route: Route) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (window.location.pathname === route) return;
  rememberScroll();
  window.history.pushState({ scrollY: 0 }, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
