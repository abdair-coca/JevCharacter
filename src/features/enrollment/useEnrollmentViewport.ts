import { useLayoutEffect, type RefObject } from "react";

/** iOS can resize only the visual viewport when its keyboard opens. */
export function useEnrollmentViewport(root: RefObject<HTMLElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const element = root.current;
    const viewport = window.visualViewport;
    if (!open || !element || !viewport) return;
    const measure = () => {
      const available = Math.max(0, viewport.height + viewport.offsetTop - element.getBoundingClientRect().top);
      element.style.setProperty("--enrollment-visible-height", `${available}px`);
    };
    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      element.style.removeProperty("--enrollment-visible-height");
    };
  }, [root, open]);
}
