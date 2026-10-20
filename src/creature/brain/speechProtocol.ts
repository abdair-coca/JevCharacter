export const SPEECH_MESSAGE_MAX_CHARS = 280;
export const SPEECH_HISTORY_LIMIT = 2;
export const SPEECH_REQUEST_TIMEOUT_MS = 12_000;
export type SpeechLanguage = "es" | "en";
export const isSpeechLanguage = (value: unknown): value is SpeechLanguage => value === "es" || value === "en";

export type SpeechExchange = {
  user: string;
  assistant: string;
};
