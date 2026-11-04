import { acceptsBlock, clampText, parseBlock, parseMemoryNote, SPEECH_SPOKEN_MAX_CHARS, type SpeechBlock, type SpeechReply } from "./speechBlocks";
import {
  GROQ_KEY_HEADER,
  isSpeechLanguage,
  isSpeechPlugin,
  SPEECH_HISTORY_LIMIT,
  SPEECH_MESSAGE_MAX_CHARS,
  type SpeechExchange,
  type SpeechLanguage,
  type SpeechPlugin,
} from "./speechProtocol";

type StreamSpeechOptions = {
  message: string;
  language: SpeechLanguage;
  history: SpeechExchange[];
  /** Persistent notes chosen for this message; the server bounds them again. */
  memory: string[];
  /** Plugins the visitor left on; the server offers the model only their tools and blocks. */
  plugins?: SpeechPlugin[];
  /** A plugin started working for this reply (Jev is looking something up). */
  onTool?: (plugin: SpeechPlugin) => void;
  /** The visitor's own Groq key, sent only as a request header. */
  apiKey?: string | null;
  signal: AbortSignal;
  onSpoken: (text: string) => void;
  onBlock: (block: SpeechBlock) => void;
};

/** A finished reply, with the note Jev chose to remember, if any. */
export type SpeechResult = SpeechReply & { memory?: string };

/** The server refused the request because the visitor's Groq key is missing or malformed. */
export class SpeechKeyRequiredError extends Error {
  constructor() {
    super("Speech key required");
    this.name = "SpeechKeyRequiredError";
  }
}

/** Too many messages for now, on this server or on the visitor's Groq key: waiting a few seconds is enough. */
export class SpeechRateError extends Error {
  constructor() {
    super("Speech rate exceeded");
    this.name = "SpeechRateError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Streams one reply: the spoken sentence first, then each block the client also validates. */
export async function streamSpeechReply({ message, language, history, memory: notes, plugins = [], onTool, apiKey, signal, onSpoken, onBlock }: StreamSpeechOptions): Promise<SpeechResult> {
  if (!isSpeechLanguage(language)) throw new Error("Invalid speech language");
  signal.throwIfAborted();
  const response = await fetch("/api/talk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(apiKey ? { [GROQ_KEY_HEADER]: apiKey } : {}),
    },
    body: JSON.stringify({
      message: message.slice(0, SPEECH_MESSAGE_MAX_CHARS),
      language,
      history: history.slice(-SPEECH_HISTORY_LIMIT),
      memory: notes,
      plugins,
    }),
    signal,
  });

  if (signal.aborted) {
    void response.body?.cancel().catch(() => undefined);
    signal.throwIfAborted();
  }

  if (response.status === 401) throw new SpeechKeyRequiredError();
  if (response.status === 429) throw new SpeechRateError();
  if (!response.ok) throw new Error("Speech response unavailable");
  if (!response.body) throw new Error("Speech stream unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];
  let spoken: string | null = null;
  const blocks: SpeechBlock[] = [];
  let memory: string | null = null;
  let streamComplete = false;
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", onAbort, { once: true });

  const dispatchEvent = () => {
    signal.throwIfAborted();
    const name = eventName;
    const data = dataLines.join("\n");
    eventName = "";
    dataLines = [];

    if (!name) return;
    if (name === "error") throw new Error("Speech stream failed");
    if (name === "done") {
      streamComplete = true;
      return;
    }
    if (name !== "spoken" && name !== "block" && name !== "memory" && name !== "tool") return;

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new Error("Invalid speech stream event");
    }
    if (!isRecord(payload)) throw new Error("Invalid speech stream event");

    // Tools run before the sentence: only a plugin this request turned on is reported.
    if (name === "tool") {
      if (isSpeechPlugin(payload.plugin) && plugins.includes(payload.plugin)) onTool?.(payload.plugin);
      return;
    }

    if (name === "spoken") {
      const text = clampText(payload.text, SPEECH_SPOKEN_MAX_CHARS);
      if (spoken !== null || !text) throw new Error("Invalid speech text");
      spoken = text;
      onSpoken(text);
      return;
    }
    if (spoken === null) throw new Error("Speech block before its sentence");
    if (name === "memory") {
      memory ??= parseMemoryNote({ type: "memory", text: payload.text });
      return;
    }
    const block = parseBlock(payload.block);
    if (block && acceptsBlock(blocks, block)) {
      blocks.push(block);
      onBlock(block);
    }
  };

  const consumeLine = (line: string) => {
    const normalized = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (normalized === "") {
      dispatchEvent();
    } else if (normalized.startsWith("event:")) {
      eventName = normalized.slice(6).trim();
    } else if (normalized.startsWith("data:")) {
      dataLines.push(normalized.slice(5).trimStart());
    }
  };

  try {
    while (!streamComplete) {
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (streamComplete) break;
        newline = buffer.indexOf("\n");
      }
      if (done) {
        if (buffer) consumeLine(buffer);
        consumeLine("");
        break;
      }
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    // A done event may arrive before the HTTP body closes. Always release it.
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  signal.throwIfAborted();
  if (!streamComplete || spoken === null) throw new Error("Incomplete speech stream");
  return memory === null ? { spoken, blocks } : { spoken, blocks, memory };
}
