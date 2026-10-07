export const SPEECH_MAX_CHARS = 120;
export const SPEECH_MESSAGE_MAX_CHARS = 280;
export const SPEECH_HISTORY_LIMIT = 2;
export const SPEECH_REQUEST_TIMEOUT_MS = 12_000;
export type SpeechLanguage = "es" | "en";
export const isSpeechLanguage = (value: unknown): value is SpeechLanguage => value === "es" || value === "en";

export type SpeechExchange = {
  user: string;
  assistant: string;
};

export type SentenceAppend = {
  text: string;
  added: string;
  complete: boolean;
};

export function appendFirstSentence(current: string, chunk: string): SentenceAppend {
  const currentLength = [...current].length;
  if (currentLength >= SPEECH_MAX_CHARS - 1) {
    return { text: current, added: "", complete: true };
  }

  const added: string[] = [];
  let complete = false;

  for (const character of chunk) {
    if (currentLength + added.length >= SPEECH_MAX_CHARS - 1) {
      complete = true;
      break;
    }
    if (currentLength === 0 && added.length === 0 && /\s/u.test(character)) continue;

    added.push(character);
    if (/[.!?…]/u.test(character) || currentLength + added.length >= SPEECH_MAX_CHARS - 1) {
      complete = true;
      break;
    }
  }

  const addition = added.join("");
  return { text: current + addition, added: addition, complete };
}

export function finishFirstSentence(text: string): string {
  const trimmed = [...text.trimEnd()].slice(0, SPEECH_MAX_CHARS - 1).join("");
  if (!trimmed) return "";
  if (".!?…".includes([...trimmed].at(-1) ?? "")) return trimmed;
  return `${trimmed}.`;
}
