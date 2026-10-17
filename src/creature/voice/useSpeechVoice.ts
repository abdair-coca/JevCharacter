import { useEffect, useRef } from "react";
import type { SpeechCaption } from "../../hooks/useSpeechSession";
import { jevVoice, type VoiceEngine } from "./voiceEngine";

/**
 * Jev chirps along with the real reply text. A caption that fades after it was
 * complete lets the phrase finish; a cancelled, unfinished reply stops it.
 */
export function useSpeechVoice(caption: SpeechCaption | null, silenced: boolean, voice: Pick<VoiceEngine, "speak" | "stopSpeech"> = jevVoice) {
  const voiced = useRef<{ complete: boolean } | null>(null);
  useEffect(() => {
    if (caption && !silenced) {
      voice.speak(`home-${caption.generation}`, caption.text, caption.complete);
      voiced.current = { complete: caption.complete };
      return;
    }
    if (voiced.current && !voiced.current.complete) voice.stopSpeech();
    voiced.current = null;
  }, [caption, silenced, voice]);
}
