import { useMemo } from "react";
import { cssDurationSeconds, useUiMotion } from "../../lib/motionTokens";
import { useReducedMotionPreference } from "../../hooks/useReducedMotionPreference";

export function useEnrollmentMotion() {
  const ui = useUiMotion();
  const reduced = useReducedMotionPreference();
  const timing = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const seconds = (name: string) => {
      const value = css.getPropertyValue(name).trim();
      // A static fallback also keeps the form usable before styles are available.
      return value ? cssDurationSeconds(value) : 0;
    };
    return { scene: seconds("--enrollment-scene"), burst: seconds("--enrollment-burst"), hold: seconds("--enrollment-reaction"), close: seconds("--enrollment-close") };
  }, []);
  return { reduced, ui, scene: { ...ui, duration: reduced ? 0 : timing.scene }, burst: reduced ? 0 : timing.burst, hold: timing.hold * 1000, close: reduced ? 0 : timing.close };
}
