import { useEffect, useState, type RefObject } from "react";
import { useReducedMotionPreference } from "./useReducedMotionPreference";

/** Permit secondary breathing only while the control is visible and motion is welcome. */
export function useAmbientMotion(ref: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotionPreference();
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(() => !document.hidden);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onVisibility = () => setForeground(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 },
    );
    if (observer) observer.observe(element);
    // No visibility observer means a static fallback, never an unseen loop.
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ref]);
  return !reduced && visible && foreground;
}
