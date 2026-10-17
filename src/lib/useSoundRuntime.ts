import { useEffect } from "react";
import { usePreferences } from "../stores/preferencesStore";
import { appAudio } from "./audioCore";

// Events that grant user activation, so the first one can start audio.
const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;

/** Connects the shared audio to the sound preference, the first gesture and tab visibility. */
export function useSoundRuntime() {
  const sound = usePreferences(state => state.sound);

  useEffect(() => { appAudio.setEnabled(sound); }, [sound]);

  useEffect(() => {
    const unlock = () => {
      appAudio.unlock();
      if (appAudio.unlocked()) for (const type of GESTURES) window.removeEventListener(type, unlock, true);
    };
    const visibility = () => appAudio.setHidden(document.visibilityState === "hidden");
    for (const type of GESTURES) window.addEventListener(type, unlock, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      for (const type of GESTURES) window.removeEventListener(type, unlock, true);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
}
