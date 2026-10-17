import { useEffect } from "react";
import { usePreferences } from "../../stores/preferencesStore";
import { jevVoice } from "./voiceEngine";

// Events that grant user activation, so the first one can start audio.
const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;

/** Connects the shared voice to the sound preference, the first gesture and tab visibility. */
export function useVoiceRuntime() {
  const sound = usePreferences(state => state.sound);

  useEffect(() => { jevVoice.setEnabled(sound); }, [sound]);

  useEffect(() => {
    const unlock = () => {
      jevVoice.unlock();
      if (jevVoice.unlocked()) for (const type of GESTURES) window.removeEventListener(type, unlock, true);
    };
    const visibility = () => jevVoice.setHidden(document.visibilityState === "hidden");
    for (const type of GESTURES) window.addEventListener(type, unlock, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      for (const type of GESTURES) window.removeEventListener(type, unlock, true);
      document.removeEventListener("visibilitychange", visibility);
      jevVoice.stop();
    };
  }, []);
}
