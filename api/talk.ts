import {
  appendFirstSentence,
  finishFirstSentence,
  SPEECH_HISTORY_LIMIT,
  SPEECH_MAX_CHARS,
  SPEECH_MESSAGE_MAX_CHARS,
  type SpeechExchange,
} from "../src/creature/brain/speechProtocol";

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

type TalkBody = { message: string; history: SpeechExchange[] };
type RateBucket = { startedAt: number; count: number };

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const UPSTREAM_TIMEOUT_MS = 8_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function isExchange(value: unknown): value is SpeechExchange {
  return isRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.user === "string" && value.user.length <= SPEECH_MESSAGE_MAX_CHARS &&
    typeof value.assistant === "string" && [...value.assistant].length <= SPEECH_MAX_CHARS;
}

function parseBody(value: unknown): TalkBody | null {
  if (!isRecord(value) || Object.keys(value).length !== 2) return null;
  if (typeof value.message !== "string" || !value.message.trim()) return null;
  if (value.message.length > SPEECH_MESSAGE_MAX_CHARS) return null;
  if (!Array.isArray(value.history) || value.history.length > SPEECH_HISTORY_LIMIT) return null;
  if (!value.history.every(isExchange)) return null;
  return { message: value.message.trim(), history: value.history };
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
  if (!bucket) {
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

function upstreamMessages(body: TalkBody) {
  return [
    {
      role: "system",
      content: "Eres Jev, compañero tranquilo. Responde al último mensaje en su idioma (español por defecto). Una frase, máximo 120 caracteres Unicode; sin prefacios ni listas. Historial solo para continuidad.",
    },
    ...body.history.flatMap((exchange) => [
      { role: "user", content: exchange.user },
      { role: "assistant", content: exchange.assistant },
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
  // GPT-OSS spends completion tokens on reasoning; low effort preserves room for the short reply.
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
        max_completion_tokens: 64,
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
    const decoder = new TextDecoder();
    let buffer = "";
    let dataLines: string[] = [];
    let sentence = "";
    let sentenceComplete = false;
    let upstreamComplete = false;
    let upstreamEnded = false;

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
      if (!delta || sentenceComplete) return;

      const update = appendFirstSentence(sentence, delta);
      sentence = update.text;
      sentenceComplete = update.complete;
      if (update.added) emit(response, "delta", { text: update.added });
    };

    const consumeLine = (line: string) => {
      const normalized = line.endsWith("\r") ? line.slice(0, -1) : line;
      if (normalized === "") dispatchData();
      else if (normalized.startsWith("data:")) dataLines.push(normalized.slice(5).trimStart());
    };

    try {
      while (!upstreamComplete && !sentenceComplete && !upstreamEnded && !abortController.signal.aborted) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          consumeLine(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          if (upstreamComplete || sentenceComplete) break;
          newline = buffer.indexOf("\n");
        }
        if (done) {
          if (buffer) consumeLine(buffer);
          consumeLine("");
          upstreamEnded = true;
        }
      }
    } finally {
      if (!upstreamComplete && !upstreamEnded) void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }

    if (abortController.signal.aborted) throw new Error("Speech request interrupted");
    if (upstreamEnded && !upstreamComplete && !sentenceComplete) {
      throw new Error("Incomplete upstream speech stream");
    }
    const finalSentence = finishFirstSentence(sentence);
    if (!finalSentence) throw new Error("Empty speech response");
    const suffix = [...finalSentence].slice([...sentence].length).join("");
    if (suffix) emit(response, "delta", { text: suffix });
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
