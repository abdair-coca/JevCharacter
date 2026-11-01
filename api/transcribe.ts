import { GROQ_KEY_HEADER, isSpeechLanguage, parseGroqKey, type SpeechLanguage } from "../src/creature/brain/speechProtocol.js";
import {
  LISTEN_AUDIO_MAX_BYTES,
  LISTEN_SAMPLE_RATE,
  LISTEN_SPEECH_MIN_MS,
  TRANSCRIPT_MAX_CHARS,
  WAV_HEADER_BYTES,
} from "../src/creature/listen/listenProtocol.js";

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => unknown;
};

type TranscribeBody = { audio: Buffer; language: SpeechLanguage };
type RateBucket = { startedAt: number; count: number };

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
// Hands-free sends every phrase it hears; Groq's own limit still applies per key.
const MAX_REQUESTS_PER_WINDOW = 30;
const UPSTREAM_TIMEOUT_MS = 8_000;
const MODEL = "whisper-large-v3-turbo";
// Whisper writes the name better when it expects it.
const NAME_PROMPT = "Jev";
// Segments Whisper itself rates as probably silence are its usual hallucinations («Gracias por ver»).
const NO_SPEECH_MAX = 0.6;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BODY_KEYS = new Set(["audio", "language"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** A 16-bit mono PCM WAV at the capture rate, long enough to hold speech and no longer than a phrase. */
function isPhraseWav(audio: Buffer) {
  if (audio.length < WAV_HEADER_BYTES || audio.length > LISTEN_AUDIO_MAX_BYTES) return false;
  if (audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") return false;
  if (audio.toString("ascii", 12, 16) !== "fmt " || audio.toString("ascii", 36, 40) !== "data") return false;
  const pcm = audio.readUInt16LE(20) === 1 && audio.readUInt16LE(22) === 1 && audio.readUInt16LE(34) === 16;
  if (!pcm || audio.readUInt32LE(24) !== LISTEN_SAMPLE_RATE) return false;
  const dataBytes = audio.readUInt32LE(40);
  const minBytes = (LISTEN_SAMPLE_RATE * 2 * LISTEN_SPEECH_MIN_MS) / 1000;
  return dataBytes === audio.length - WAV_HEADER_BYTES && dataBytes >= minBytes;
}

function parseBody(value: unknown): TranscribeBody | null {
  if (!isRecord(value) || !Object.keys(value).every((key) => BODY_KEYS.has(key))) return null;
  if (!isSpeechLanguage(value.language)) return null;
  if (typeof value.audio !== "string" || value.audio.length > Math.ceil(LISTEN_AUDIO_MAX_BYTES / 3) * 4) return null;
  if (!BASE64_PATTERN.test(value.audio)) return null;
  const audio = Buffer.from(value.audio, "base64");
  return isPhraseWav(audio) ? { audio, language: value.language } : null;
}

function clientKey(request: ApiRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || "unknown";
  if (Array.isArray(forwarded)) return forwarded[0]?.split(",")[0]?.trim() || "unknown";
  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  if (rateBuckets.size > 500) {
    for (const [id, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(id);
    }
    if (rateBuckets.size > 1000) rateBuckets.clear();
  }
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

/** The text of the segments Whisper heard as speech; the whole text when it reports no segments. */
function spokenText(value: unknown) {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  if (!Array.isArray(value.segments)) return value.text;
  return value.segments
    .filter((segment): segment is Record<string, unknown> => isRecord(segment) && typeof segment.text === "string")
    .filter((segment) => typeof segment.no_speech_prob !== "number" || segment.no_speech_prob < NO_SPEECH_MAX)
    .map((segment) => String(segment.text))
    .join("");
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Allow", "POST");

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (isRateLimited(clientKey(request))) {
    return response.status(429).json({ error: "Transcription rate exceeded" });
  }

  const body = parseBody(request.body);
  if (!body) return response.status(400).json({ error: "Invalid transcription request" });

  // The visitor's own key arrives per request and is only forwarded upstream, never logged or stored.
  const apiKey = parseGroqKey(request.headers[GROQ_KEY_HEADER]);
  if (!apiKey) return response.status(401).json({ error: "Speech key required" });

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(body.audio)], { type: "audio/wav" }), "phrase.wav");
  form.append("model", MODEL);
  form.append("language", body.language);
  form.append("prompt", NAME_PROMPT);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: abortController.signal,
    });
    if (upstream.status === 401) return response.status(401).json({ error: "Speech key rejected" });
    if (upstream.status === 429) return response.status(429).json({ error: "Transcription quota exceeded" });
    if (!upstream.ok) return response.status(502).json({ error: "Transcription unavailable" });
    const text = spokenText(await upstream.json());
    if (text === null) return response.status(502).json({ error: "Transcription unavailable" });
    return response.status(200).json({ text: text.trim().slice(0, TRANSCRIPT_MAX_CHARS) });
  } catch {
    return response.status(502).json({ error: "Transcription unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}
