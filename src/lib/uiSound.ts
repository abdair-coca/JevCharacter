import { useEffect, useRef } from "react";
import { appAudio, type AudioCore } from "./audioCore";

/** What a press means, so each kind of control answers with its own short sound. */
export type UiSoundKind = "tap" | "on" | "off" | "select" | "navigate";
type Blip = { at: number; from: number; to: number; duration: number; gain: number };
type UiSoundOptions = { core?: AudioCore; now?: () => number };

// Tiny sine blips on Jev's pentatonic notes (D5, E5, G5, A5, B5): shorter and softer than any word of Jev.
const SOUNDS: Record<UiSoundKind, readonly Blip[]> = {
  tap: [{ at: 0, from: 784, to: 659, duration: 0.07, gain: 0.5 }],
  select: [{ at: 0, from: 659, to: 880, duration: 0.09, gain: 0.5 }],
  on: [{ at: 0, from: 659, to: 659, duration: 0.06, gain: 0.4 }, { at: 0.06, from: 988, to: 988, duration: 0.08, gain: 0.5 }],
  off: [{ at: 0, from: 988, to: 988, duration: 0.06, gain: 0.4 }, { at: 0.06, from: 659, to: 659, duration: 0.08, gain: 0.35 }],
  navigate: [{ at: 0, from: 587, to: 880, duration: 0.12, gain: 0.4 }],
};
const ATTACK = 0.006;
const SILENT = 0.0001;
// Presses closer than this sound once: a double click is one gesture.
const MIN_GAP_MS = 45;
const CONTROL = "button, a[href], summary, [role='button'], [role='switch']";

/**
 * The sound a press on `target` makes, or null when it is not a control or cannot act.
 * Read it before the press runs: a toggle still shows the state it is leaving.
 */
export function uiSoundFor(target: EventTarget | null): UiSoundKind | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest(CONTROL);
  if (!control || control.matches(":disabled, [aria-disabled='true']")) return null;
  const state = control.getAttribute("aria-pressed") ?? control.getAttribute("aria-expanded") ?? control.getAttribute("aria-checked");
  if (state !== null) {
    // One choice among several (a swatch, a language) is a selection; a lone switch turns on or off.
    if (control.hasAttribute("aria-pressed") && control.parentElement?.closest("[role='group']")) return state === "true" ? "tap" : "select";
    return state === "true" ? "off" : "on";
  }
  if (control instanceof HTMLAnchorElement) return control.getAttribute("href")?.startsWith("/") ? "navigate" : "tap";
  return "tap";
}

/** Interface clicks on the shared audio core's dry `ui` bus; they follow the sound preference and the tab. */
export function createUiSound({ core = appAudio, now = () => performance.now() }: UiSoundOptions = {}) {
  let last = -Infinity;
  return {
    play(kind: UiSoundKind) {
      const context = core.context();
      const output = core.bus("ui");
      if (!core.audible() || !context || !output) return;
      const time = now();
      if (time - last < MIN_GAP_MS) return;
      last = time;
      const startAt = context.currentTime + 0.005;
      for (const blip of SOUNDS[kind]) {
        const start = startAt + blip.at;
        const end = start + blip.duration;
        const tone = context.createOscillator();
        const envelope = context.createGain();
        tone.type = "sine";
        tone.frequency.setValueAtTime(blip.from, start);
        if (blip.to !== blip.from) tone.frequency.exponentialRampToValueAtTime(blip.to, end);
        envelope.gain.setValueAtTime(SILENT, start);
        envelope.gain.linearRampToValueAtTime(blip.gain, start + ATTACK);
        envelope.gain.exponentialRampToValueAtTime(SILENT, end);
        tone.connect(envelope).connect(output);
        tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
        tone.start(start);
        tone.stop(end + 0.02);
      }
    },
  };
}

export type UiSound = ReturnType<typeof createUiSound>;
const appUiSound = createUiSound();

/** Every press of a control clicks, except while `enabled` is false (Historia leaves its music alone). */
export function useUiSounds(enabled: boolean, sound: UiSound = appUiSound) {
  const allowed = useRef(enabled);
  useEffect(() => { allowed.current = enabled; }, [enabled]);

  useEffect(() => {
    // The capture phase reads the control before its handler changes it. The sound waits for every
    // handler, so turning sound on is heard and turning it off is not.
    const press = (event: MouseEvent) => {
      if (!allowed.current) return;
      const kind = uiSoundFor(event.target);
      if (kind) window.setTimeout(() => sound.play(kind), 0);
    };
    window.addEventListener("click", press, true);
    return () => window.removeEventListener("click", press, true);
  }, [sound]);
}
