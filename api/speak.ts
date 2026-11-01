import { SPEECH_SPOKEN_MAX_CHARS } from "../src/creature/brain/speechBlocks.js";
import {
  GEMINI_KEY_HEADER,
  isSpeechLanguage,
  parseGeminiKey,
  SPEECH_AUDIO_SAMPLE_RATE,
  type SpeechLanguage,
} from "../src/creature/brain/speechProtocol.js";

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
  on?: (event: "aborted", listener: () => void) => void;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => unknown;
  write: (chunk: Uint8Array) => boolean;
  end: () => void;
  on: (event: "close", listener: () => void) => ApiResponse;
  flushHeaders?: () => void;
  headersSent?: boolean;
  writableEnded?: boolean;
};

type SpeakBody = { text: string; language: SpeechLanguage };
type RateBucket = { startedAt: number; count: number };

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
// The first audio must arrive soon: past this, the browser has already switched to Jev's chirps.
const FIRST_AUDIO_TIMEOUT_MS = 6_000;
const TOTAL_TIMEOUT_MS = 14_000;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const BODY_KEYS = new Set(["text", "language"]);
// Jev's character, the same in both languages; the model reads the sentence verbatim. The first, livelier
// style with giggles sounded exaggerated in Spanish; the user chose this calmer one on 2026-11-01.
const STYLE: Record<SpeechLanguage, string> = {
  es: "Voz cálida y amable de una criatura pequeña, curiosa, con un toque juguetón muy ligero. Habla natural y tranquila, sin exagerar la entonación y sin reír. Español latinoamericano neutro.",
  en: "A small creature's warm, friendly voice, curious, with a very light playful touch. It speaks naturally and calmly, without exaggerated intonation and without laughing.",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function parseBody(value: unknown): SpeakBody | null {
  if (!isRecord(value) || !Object.keys(value).every((key) => BODY_KEYS.has(key))) return null;
  if (!isSpeechLanguage(value.language) || typeof value.text !== "string") return null;
  const text = value.text.trim();
  if (!text || [...text].length > SPEECH_SPOKEN_MAX_CHARS) return null;
  return { text, language: value.language };
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

/** The base64 audio of one streamed event, or null when the event carries none. */
function audioDelta(value: unknown) {
  if (!isRecord(value) || value.event_type !== "step.delta" || !isRecord(value.delta)) return null;
  return value.delta.type === "audio" && typeof value.delta.data === "string" ? value.delta.data : null;
}

function upstreamBody(body: SpeakBody, voice: string, model: string) {
  return {
    model,
    input: [{
      type: "user_input",
      content: [{ type: "text", text: body.text, annotations: [{ type: "speech_metadata", style: STYLE[body.language] }] }],
    }],
    response_format: { type: "audio", mime_type: "audio/l16", sample_rate: SPEECH_AUDIO_SAMPLE_RATE },
    generation_config: { speech_config: [{ voice }] },
    stream: true,
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Allow", "POST");

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (isRateLimited(clientKey(request))) {
    return response.status(429).json({ error: "Voice rate exceeded" });
  }

  const body = parseBody(request.body);
  if (!body) return response.status(400).json({ error: "Invalid voice request" });

  // The visitor's own key arrives per request and is only forwarded upstream, never logged or stored.
  const apiKey = parseGeminiKey(request.headers[GEMINI_KEY_HEADER]);
  if (!apiKey) return response.status(401).json({ error: "Voice key required" });

  const abortController = new AbortController();
  let clientDisconnected = false;
  const firstAudioTimeout = setTimeout(() => abortController.abort(), FIRST_AUDIO_TIMEOUT_MS);
  const totalTimeout = setTimeout(() => abortController.abort(), TOTAL_TIMEOUT_MS);
  request.on?.("aborted", () => {
    clientDisconnected = true;
    abortController.abort();
  });
  response.on("close", () => {
    if (!response.writableEnded) {
      clientDisconnected = true;
      abortController.abort();
    }
  });

  const model = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-lite-tts";
  const voice = process.env.GEMINI_TTS_VOICE?.trim() || "Puck";
  let streaming = false;

  try {
    const upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(upstreamBody(body, voice, model)),
      signal: abortController.signal,
    });
    // Google answers a bad key with 400, 401 or 403; the browser only needs to know the key failed.
    if ([400, 401, 403].includes(upstream.status)) return response.status(401).json({ error: "Voice key rejected" });
    if (upstream.status === 429) return response.status(429).json({ error: "Voice quota exceeded" });
    if (!upstream.ok || !upstream.body) return response.status(502).json({ error: "Voice unavailable" });

    const reader = upstream.body.getReader();
    const cancelReader = () => { void reader.cancel().catch(() => undefined); };
    abortController.signal.addEventListener("abort", cancelReader, { once: true });
    const decoder = new TextDecoder();
    let buffer = "";
    let dataLines: string[] = [];

    // Audio goes out as soon as it arrives; the headers wait for the first chunk so failures keep their status.
    const dispatch = () => {
      const data = dataLines.join("\n");
      dataLines = [];
      if (!data || data === "[DONE]") return;
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }
      const audio = audioDelta(payload);
      if (!audio) return;
      if (!streaming) {
        streaming = true;
        clearTimeout(firstAudioTimeout);
        response.status(200);
        response.setHeader("Content-Type", `audio/L16;rate=${SPEECH_AUDIO_SAMPLE_RATE};channels=1`);
        response.setHeader("X-Accel-Buffering", "no");
        response.flushHeaders?.();
      }
      response.write(Buffer.from(audio, "base64"));
    };

    try {
      while (!abortController.signal.aborted) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, "");
          buffer = buffer.slice(newline + 1);
          if (line === "") dispatch();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
          newline = buffer.indexOf("\n");
        }
        if (done) {
          if (buffer.startsWith("data:")) dataLines.push(buffer.slice(5).trimStart());
          dispatch();
          break;
        }
      }
    } finally {
      abortController.signal.removeEventListener("abort", cancelReader);
      void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }

    if (abortController.signal.aborted && !clientDisconnected && !streaming) {
      return response.status(504).json({ error: "Voice too slow" });
    }
    if (!streaming) return response.status(502).json({ error: "Voice unavailable" });
    response.end();
  } catch {
    if (clientDisconnected || response.writableEnded) return;
    if (streaming || response.headersSent) response.end();
    else response.status(502).json({ error: "Voice unavailable" });
  } finally {
    clearTimeout(firstAudioTimeout);
    clearTimeout(totalTimeout);
  }
}
