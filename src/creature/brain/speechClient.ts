import {
  appendFirstSentence,
  isSpeechLanguage,
  SPEECH_HISTORY_LIMIT,
  SPEECH_MESSAGE_MAX_CHARS,
  type SpeechExchange,
  type SpeechLanguage,
} from "./speechProtocol";

type StreamSpeechOptions = {
  message: string;
  language: SpeechLanguage;
  history: SpeechExchange[];
  signal: AbortSignal;
  onText: (text: string) => void;
};

export async function streamSpeechReply({ message, language, history, signal, onText }: StreamSpeechOptions) {
  if (!isSpeechLanguage(language)) throw new Error("Invalid speech language");
  signal.throwIfAborted();
  const response = await fetch("/api/talk", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      message: message.slice(0, SPEECH_MESSAGE_MAX_CHARS),
      language,
      history: history.slice(-SPEECH_HISTORY_LIMIT),
    }),
    signal,
  });

  if (signal.aborted) {
    void response.body?.cancel().catch(() => undefined);
    signal.throwIfAborted();
  }

  if (!response.ok) throw new Error("Speech response unavailable");
  if (!response.body) throw new Error("Speech stream unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];
  let text = "";
  let sentenceComplete = false;
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
    if (name !== "delta" || sentenceComplete) return;

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new Error("Invalid speech stream event");
    }
    if (!payload || typeof payload !== "object" || !("text" in payload) || typeof payload.text !== "string") throw new Error("Invalid speech text");

    const update = appendFirstSentence(text, payload.text);
    if (update.added) {
      text = update.text;
      sentenceComplete = update.complete;
      onText(text);
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
  if (!streamComplete || !text.trim()) throw new Error("Incomplete speech stream");
  return text;
}
