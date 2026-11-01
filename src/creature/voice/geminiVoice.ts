import { useSyncExternalStore } from "react";
import { appAudio, type AudioCore } from "../../lib/audioCore";
import { readGeminiKey } from "../brain/geminiKeyStore";
import { GEMINI_KEY_HEADER, SPEECH_AUDIO_SAMPLE_RATE, type SpeechLanguage } from "../brain/speechProtocol";
import { jevVoice, type VoiceEngine } from "./voiceEngine";

/** Past this without audio, Jev chirps the sentence himself. */
const FIRST_AUDIO_TIMEOUT_MS = 3_000;

/** Why the saved Google key is not giving Jev a voice right now; Ajustes shows it. */
export type VoiceProblem = "rejected" | "quota" | null;

let problem: VoiceProblem = null;
const listeners = new Set<() => void>();

function setProblem(next: VoiceProblem) {
  if (problem === next) return;
  problem = next;
  for (const listener of listeners) listener();
}

export const voiceProblem = {
  read: () => problem,
  report: setProblem,
  clear: () => setProblem(null),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function useVoiceProblem() {
  return useSyncExternalStore(voiceProblem.subscribe, voiceProblem.read, voiceProblem.read);
}

/** `/api/speak` answered without audio. */
export class VoiceRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Voice unavailable (${status})`);
    this.name = "VoiceRequestError";
    this.status = status;
  }
}

/** Turns 16-bit little-endian PCM bytes into samples, carrying a byte split across chunks. */
export function createPcmDecoder() {
  let carry: number | null = null;
  return (bytes: Uint8Array): Float32Array => {
    const joined = carry === null ? bytes : Uint8Array.of(carry, ...bytes);
    const count = Math.floor(joined.length / 2);
    carry = joined.length % 2 === 1 ? joined[joined.length - 1] : null;
    const view = new DataView(joined.buffer, joined.byteOffset, count * 2);
    const samples = new Float32Array(count);
    for (let index = 0; index < count; index++) samples[index] = view.getInt16(index * 2, true) / 0x8000;
    return samples;
  };
}

type StreamVoiceOptions = {
  text: string;
  language: SpeechLanguage;
  /** The visitor's own Google key, sent only as a request header. */
  apiKey: string;
  signal: AbortSignal;
  onAudio: (samples: Float32Array) => void;
};

/** Streams Jev's sentence from `/api/speak` as it is synthesized. */
export async function streamVoice({ text, language, apiKey, signal, onAudio }: StreamVoiceOptions): Promise<void> {
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json", [GEMINI_KEY_HEADER]: apiKey },
    body: JSON.stringify({ text, language }),
    signal,
  });
  if (!response.ok || !response.body) throw new VoiceRequestError(response.status);
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const decode = createPcmDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      signal.throwIfAborted();
      const samples = decode(value);
      if (samples.length > 0) onAudio(samples);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

type GeminiVoiceOptions = {
  engine?: Pick<VoiceEngine, "speak" | "stopSpeech" | "beginSpeech">;
  core?: Pick<AudioCore, "audible">;
  readKey?: () => string | null;
  stream?: typeof streamVoice;
};

/**
 * Jev's spoken voice: with the visitor's Google key a finished sentence is said by Gemini after Jev's
 * signature chirp; without a key, muted, or when Gemini fails or is slow, Jev chirps it as always.
 */
export function createGeminiVoice({ engine = jevVoice, core = appAudio, readKey = readGeminiKey, stream = streamVoice }: GeminiVoiceOptions = {}) {
  let request: AbortController | null = null;
  const cancel = () => {
    request?.abort();
    request = null;
  };

  return {
    speak(key: string, text: string, complete: boolean, onEnd?: () => void, language: SpeechLanguage = "es") {
      const apiKey = readKey();
      cancel();
      if (!complete || !apiKey || !core.audible()) {
        engine.speak(key, text, complete, onEnd);
        return;
      }
      const controller = new AbortController();
      request = controller;
      const handle = engine.beginSpeech(key, onEnd);
      let started = false;
      const slow = window.setTimeout(() => {
        if (started) return;
        controller.abort();
        handle.fallback(text);
      }, FIRST_AUDIO_TIMEOUT_MS);
      const settle = (failed: boolean) => {
        window.clearTimeout(slow);
        if (request === controller) request = null;
        // A cut reply, or one that already fell back on the chirps, has nothing left to do.
        if (controller.signal.aborted) return;
        if (started) handle.finish();
        else handle.fallback(text);
        if (!failed) setProblem(null);
      };
      stream({
        text, language, apiKey, signal: controller.signal,
        onAudio: samples => {
          if (!handle.active) {
            controller.abort();
            return;
          }
          started = true;
          handle.play(samples, SPEECH_AUDIO_SAMPLE_RATE);
        },
      }).then(() => settle(false), (error: unknown) => {
        if (error instanceof VoiceRequestError && error.status === 401) setProblem("rejected");
        if (error instanceof VoiceRequestError && error.status === 429) setProblem("quota");
        settle(true);
      });
    },
    stopSpeech() {
      cancel();
      engine.stopSpeech();
    },
  };
}

/** Home's voice: Gemini when the visitor saved a Google key, Jev's chirps otherwise. */
export const homeVoice = createGeminiVoice();
