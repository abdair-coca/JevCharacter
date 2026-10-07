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
export function navigate(event: MouseEvent<HTMLAnchorElement>, route: Route) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (window.location.pathname === route) return;
  window.history.pushState(null, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
