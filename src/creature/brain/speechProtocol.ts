export const SPEECH_MESSAGE_MAX_CHARS = 280;
export const SPEECH_HISTORY_LIMIT = 2;
export const SPEECH_REQUEST_TIMEOUT_MS = 12_000;
export type SpeechLanguage = "es" | "en";
export const isSpeechLanguage = (value: unknown): value is SpeechLanguage => value === "es" || value === "en";

export type SpeechExchange = {
  user: string;
  assistant: string;
};

/** Carries the visitor's own Groq key to `/api/talk` and `/api/transcribe`; the server uses it for that request and never stores it. */
export const GROQ_KEY_HEADER = "x-groq-api-key";
/** Carries the visitor's own Google key to `/api/speak`, under the same rules. */
export const GEMINI_KEY_HEADER = "x-gemini-api-key";
const API_KEY_PATTERN = /^[\x21-\x7E]{20,200}$/;

/** The trimmed key when it is visible ASCII of plausible length, else null. Shared by the browser and the API. */
export function parseGroqKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return API_KEY_PATTERN.test(key) ? key : null;
}

/** Google keys pass the same shape check; the provider is the one that accepts or rejects them. */
export const parseGeminiKey = parseGroqKey;

/** Jev's voice arrives as headerless 16-bit mono PCM at this rate. */
export const SPEECH_AUDIO_SAMPLE_RATE = 24_000;
