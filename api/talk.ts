import {
  acceptsBlock,
  createJsonObjectScanner,
  parseBlock,
  parseSpoken,
  SPEECH_BLOCKS_MAX,
  SPEECH_HISTORY_REPLY_MAX_CHARS,
  splitHistoryReply,
  type SpeechBlock,
} from "../src/creature/brain/speechBlocks.js";
import {
  isSpeechLanguage,
  SPEECH_HISTORY_LIMIT,
  SPEECH_MESSAGE_MAX_CHARS,
  type SpeechExchange,
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
  write: (chunk: string) => boolean;
  end: () => void;
  on: (event: "close", listener: () => void) => ApiResponse;
  flushHeaders?: () => void;
  headersSent?: boolean;
  writableEnded?: boolean;
};

type TalkBody = { message: string; language: SpeechLanguage; history: SpeechExchange[] };
type RateBucket = { startedAt: number; count: number };

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const UPSTREAM_TIMEOUT_MS = 8_000;
// Measured 2026-10-20 with gpt-oss-20b: replies with blocks used at most 231 completion tokens.
const MAX_COMPLETION_TOKENS = 384;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function isExchange(value: unknown): value is SpeechExchange {
  return isRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.user === "string" && Boolean(value.user.trim()) && value.user.length <= SPEECH_MESSAGE_MAX_CHARS &&
    typeof value.assistant === "string" && Boolean(value.assistant.trim()) && [...value.assistant].length <= SPEECH_HISTORY_REPLY_MAX_CHARS;
}

function parseBody(value: unknown): TalkBody | null {
  if (!isRecord(value) || Object.keys(value).length !== 3) return null;
  if (!isSpeechLanguage(value.language)) return null;
  if (typeof value.message !== "string" || !value.message.trim()) return null;
  if (value.message.length > SPEECH_MESSAGE_MAX_CHARS) return null;
  if (!Array.isArray(value.history) || value.history.length > SPEECH_HISTORY_LIMIT) return null;
  if (!value.history.every(isExchange)) return null;
  return { message: value.message.trim(), language: value.language, history: value.history };
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

function emit(response: ApiResponse, event: string, payload: unknown) {
  if (response.writableEnded) return;
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function firstTextDelta(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.choices)) return "";
  const choice = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.delta)) return "";
  return typeof choice.delta.content === "string" ? choice.delta.content : "";
}

function systemPrompt(language: SpeechLanguage) {
  return `Eres Jev, compañero tranquilo y cálido. Responde exclusivamente en ${language === "es" ? "español (Spanish)" : "inglés (English)"}, aunque el mensaje o el historial estén en otro idioma.
Formato obligatorio: solo objetos JSON, uno por línea, sin markdown ni texto fuera de ellos.
Primero: {"type":"spoken","text":"..."}, una frase de máximo 120 caracteres que dirás en voz alta.
Si es charla, saludo o algo breve, termina ahí.
Si pide explicar, comparar, enumerar o dar pasos, añade de 1 a 6 bloques (máximo 650 caracteres visibles en total) usando solo:
{"type":"paragraph","text":"máx 320","emphasis":["opcional: hasta 3 frases exactas del texto"]}
{"type":"list","items":["2 a 6 ítems, máx 120 cada uno"]}
{"type":"steps","items":["2 a 6 pasos sin numerar, máx 120 cada uno"]}
{"type":"compare","columns":[{"title":"máx 40","points":["1 a 4, máx 90 cada uno"]}]} con 2 o 3 columnas
{"type":"highlight","value":"máx 24","label":"máx 80"}
{"type":"callout","tone":"tip o warning","text":"máx 200"}
{"type":"chips","items":["1 a 3 preguntas para continuar, máx 60 cada una"]}, siempre al final
Historial solo para continuidad.`;
}

// Past replies return to the model in the same object format it must answer in.
function historyContent(assistant: string) {
  const { spoken, digest } = splitHistoryReply(assistant);
  const objects = [{ type: "spoken", text: spoken }, ...(digest ? [{ type: "paragraph", text: digest }] : [])];
  return objects.map((object) => JSON.stringify(object)).join("\n");
}

function upstreamMessages(body: TalkBody) {
  return [
    { role: "system", content: systemPrompt(body.language) },
    ...body.history.flatMap((exchange) => [
      { role: "user", content: exchange.user },
      { role: "assistant", content: historyContent(exchange.assistant) },
    ]),
    { role: "user", content: body.message },
  ];
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Allow", "POST");

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }
  if (isRateLimited(clientKey(request))) {
    return response.status(429).json({ error: "Speech rate exceeded" });
  }

  const body = parseBody(request.body);
  if (!body) return response.status(400).json({ error: "Invalid speech request" });

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return response.status(503).json({ error: "Speech unavailable" });

  const abortController = new AbortController();
  let clientDisconnected = false;
  const timeout = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS);
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

  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  // GPT-OSS spends completion tokens on reasoning; low effort preserves room for the reply.
  const supportsReasoningEffort = model === "openai/gpt-oss-20b" || model === "openai/gpt-oss-120b";

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: upstreamMessages(body),
        stream: true,
        store: false,
        temperature: 0.55,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        ...(supportsReasoningEffort ? { reasoning_effort: "low" } : {}),
      }),
      signal: abortController.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return response.status(502).json({ error: "Speech unavailable" });
    }

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();

    const reader = upstream.body.getReader();
    const cancelReader = () => { void reader.cancel().catch(() => undefined); };
    abortController.signal.addEventListener("abort", cancelReader, { once: true });
    const decoder = new TextDecoder();
    let buffer = "";
    let dataLines: string[] = [];
    const scanner = createJsonObjectScanner();
    let spoken: string | null = null;
    const blocks: SpeechBlock[] = [];
    let blocksFull = false;
    let upstreamComplete = false;
    let upstreamEnded = false;

    // The first object must be the spoken sentence; later ones are blocks, kept while they fit.
    const acceptObject = (raw: string) => {
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        value = undefined;
      }
      if (spoken === null) {
        spoken = parseSpoken(value);
        if (spoken === null) throw new Error("Invalid spoken sentence");
        emit(response, "spoken", { text: spoken });
        return;
      }
      const block = parseBlock(value);
      if (block && acceptsBlock(blocks, block)) {
        blocks.push(block);
        emit(response, "block", { block });
      }
      blocksFull = blocks.length >= SPEECH_BLOCKS_MAX;
    };

    const dispatchData = () => {
      const data = dataLines.join("\n");
      dataLines = [];
      if (!data) return;
      if (data === "[DONE]") {
        upstreamComplete = true;
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        throw new Error("Invalid upstream event");
      }
      const delta = firstTextDelta(payload);
      for (const object of delta ? scanner.push(delta) : []) {
        if (blocksFull) return;
        acceptObject(object);
      }
    };

    const consumeLine = (line: string) => {
      const normalized = line.endsWith("\r") ? line.slice(0, -1) : line;
      if (normalized === "") dispatchData();
      else if (normalized.startsWith("data:")) dataLines.push(normalized.slice(5).trimStart());
    };

    try {
      while (!upstreamComplete && !blocksFull && !upstreamEnded && !abortController.signal.aborted) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          consumeLine(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          if (upstreamComplete || blocksFull) break;
          newline = buffer.indexOf("\n");
        }
        if (done) {
          if (buffer) consumeLine(buffer);
          consumeLine("");
          upstreamEnded = true;
        }
      }
    } finally {
      abortController.signal.removeEventListener("abort", cancelReader);
      void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }

    if (abortController.signal.aborted) throw new Error("Speech request interrupted");
    if (upstreamEnded && !upstreamComplete && !blocksFull) {
      throw new Error("Incomplete upstream speech stream");
    }
    if (spoken === null) throw new Error("Empty speech response");
    emit(response, "done", {});
    response.end();
  } catch {
    if (clientDisconnected || response.writableEnded) return;
    if (response.headersSent) {
      emit(response, "error", {});
      response.end();
    } else {
      response.status(502).json({ error: "Speech unavailable" });
    }
  } finally {
    clearTimeout(timeout);
  }
}
