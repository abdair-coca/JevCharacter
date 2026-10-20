import { useEffect, useRef } from "react";
import type { SpeechCaption } from "../../hooks/useSpeechSession";
import { jevVoice, type VoiceEngine } from "./voiceEngine";

const noop = () => {};

/**
 * Jev chirps along with the real reply text. A caption that fades after it was
 * complete lets the phrase finish; a cancelled, unfinished reply stops it. `onFinished`
 * runs once a complete reply has sounded its last syllable, or at once when nothing sounds.
 */
export function useSpeechVoice(
  caption: SpeechCaption | null,
  silenced: boolean,
  voice: Pick<VoiceEngine, "speak" | "stopSpeech"> = jevVoice,
  onFinished: () => void = noop,
) {
  const voiced = useRef<{ complete: boolean } | null>(null);
  const finished = useRef(onFinished);
  useEffect(() => { finished.current = onFinished; }, [onFinished]);
  useEffect(() => {
    if (caption && !silenced) {
      voice.speak(`home-${caption.generation}`, caption.text, caption.complete, caption.complete ? () => finished.current() : undefined);
      voiced.current = { complete: caption.complete };
      return;
    }
    if (voiced.current && !voiced.current.complete) voice.stopSpeech();
    // A complete reply that is not voiced has nothing left to sound.
    if (caption?.complete) finished.current();
    voiced.current = null;
  }, [caption, silenced, voice]);
}
