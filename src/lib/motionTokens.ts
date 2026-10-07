import { useMemo } from "react";
import type { Transition } from "motion/react";
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference";

let cached: Transition | undefined;
export function cssDurationSeconds(value: string): number {
  const match = value.trim().match(/^(\d*\.?\d+)(ms|s)$/);
  if (!match) throw new Error("Invalid CSS duration token");
  return Number(match[1]) / (match[2] === "ms" ? 1000 : 1);
}

function readUiMotion(): Transition {
  if (cached) return cached;
  const css = getComputedStyle(document.documentElement);
  const duration = css.getPropertyValue("--duration-ui").trim();
  const easing = css.getPropertyValue("--ease-out").match(/[\d.]+/g)?.map(Number);
  if (easing?.length !== 4) throw new Error("Invalid UI easing token");
  // The production CSS optimizer can convert milliseconds to seconds.
  cached = { duration: cssDurationSeconds(duration), ease: [easing[0], easing[1], easing[2], easing[3]] };
  return cached;
}

export function useUiMotion(): Transition {
  const reduced = useReducedMotionPreference();
  return useMemo(() => reduced ? { duration: 0 } : readUiMotion(), [reduced]);
}

export function useFeedbackScale(): number {
  return useMemo(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-scale-feedback")), []);
}

export function useThemeIconMotion() {
  const reduced = useReducedMotionPreference();
  const tokens = useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      turn: Number.parseFloat(styles.getPropertyValue("--motion-theme-turn")),
      scale: Number.parseFloat(styles.getPropertyValue("--motion-theme-scale")),
    };
  }, []);
  return reduced ? { turn: 0, scale: 1 } : tokens;
}

export function useOrganicMotion() {
  const reduced = useReducedMotionPreference();
  const tokens = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const number = (name: string) => Number.parseFloat(css.getPropertyValue(name));
    const easing = css.getPropertyValue("--ease-in-out").match(/[\d.]+/g)?.map(Number);
    if (easing?.length !== 4) throw new Error("Invalid organic easing token");
    return {
      ease: [easing[0], easing[1], easing[2], easing[3]] as [number, number, number, number],
      breathe: cssDurationSeconds(css.getPropertyValue("--duration-breathe")),
      consider: cssDurationSeconds(css.getPropertyValue("--duration-consider")),
      stagger: cssDurationSeconds(css.getPropertyValue("--duration-stagger")),
      scale: number("--motion-breathe-scale"),
      revealScale: number("--motion-reveal-scale"),
      pressScale: number("--motion-press-deep"),
      turn: number("--motion-soft-turn"),
      opacityLow: number("--opacity-aura-low"),
      opacityHigh: number("--opacity-aura-high"),
      stiffness: number("--motion-spring-stiffness"),
      damping: number("--motion-spring-damping"),
    };
  }, []);
  return { ...tokens, reduced: Boolean(reduced), spring: reduced ? { duration: 0 } : { type: "spring" as const, stiffness: tokens.stiffness, damping: tokens.damping } };
}
