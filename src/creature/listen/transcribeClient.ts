import { SpeechKeyRequiredError } from "../brain/speechClient";
import { GROQ_KEY_HEADER, type SpeechLanguage } from "../brain/speechProtocol";
import { TRANSCRIPT_MAX_CHARS } from "./listenProtocol";
import { bytesToBase64 } from "./wav";

/** Groq refused the phrase because the visitor's key ran out of quota for now. */
export class TranscribeQuotaError extends Error {
  constructor() {
    super("Transcription quota exceeded");
    this.name = "TranscribeQuotaError";
  }
}

type TranscribeOptions = {
  wav: Uint8Array;
  language: SpeechLanguage;
  /** The visitor's own Groq key, sent only as a request header. */
  apiKey: string | null;
  signal: AbortSignal;
};

/** Sends one heard phrase to `/api/transcribe` and returns what was said, possibly empty. */
export async function transcribePhrase({ wav, language, apiKey, signal }: TranscribeOptions): Promise<string> {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { [GROQ_KEY_HEADER]: apiKey } : {}) },
    body: JSON.stringify({ audio: bytesToBase64(wav), language }),
    signal,
  });
  if (response.status === 401) throw new SpeechKeyRequiredError();
  if (response.status === 429) throw new TranscribeQuotaError();
  if (!response.ok) throw new Error("Transcription unavailable");
  const body: unknown = await response.json();
  const text = typeof body === "object" && body !== null && "text" in body ? body.text : null;
  if (typeof text !== "string") throw new Error("Invalid transcription");
  return text.trim().slice(0, TRANSCRIPT_MAX_CHARS);
}
