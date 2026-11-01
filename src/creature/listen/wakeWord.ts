// How Whisper tends to write «Jev» in Spanish and English, besides the name itself.
const NAME = /(?<![\p{L}\p{N}])(?:j[eé]v|y[eé]v|j[eé]b|y[eé]b|jeff?|chev|shev|gev)(?![\p{L}\p{N}])/giu;
// Words that only call for attention: «Oye, Jev» summons Jev, «Hola, Jev» greets him.
const SUMMON_ONLY = /^(?:hey|oye|ey|eh|ok|okay|oh|ah)$/iu;

export type WakeMatch = { addressed: boolean; message: string };

/** Finds Jev's name anywhere in a transcript and returns the rest as the message for him. */
export function matchWakeWord(transcript: string): WakeMatch {
  NAME.lastIndex = 0;
  if (!NAME.test(transcript)) return { addressed: false, message: "" };
  const message = transcript
    .replace(NAME, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([¡¿])[\s,]+/g, "$1")
    .replace(/,(?=\s*[,.;:!?])/g, "")
    .replace(/^[\s,.;:]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const words = message.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.every(word => SUMMON_ONLY.test(word))) return { addressed: true, message: "" };
  return { addressed: true, message };
}
