import {
  appendFirstSentence,
  SPEECH_HISTORY_LIMIT,
  SPEECH_MESSAGE_MAX_CHARS,
  type SpeechExchange,
} from "./speechProtocol";

type StreamSpeechOptions = {
  message: string;
  history: SpeechExchange[];
  signal: AbortSignal;
  onText: (text: string) => void;
};

type SpeechEventPayload = { text?: unknown };

export async function streamSpeechReply({ message, history, signal, onText }: StreamSpeechOptions) {
  const response = await fetch("/api/talk", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      message: message.slice(0, SPEECH_MESSAGE_MAX_CHARS),
      history: history.slice(-SPEECH_HISTORY_LIMIT),
    }),
    signal,
  });

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

  const dispatchEvent = () => {
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

    let payload: SpeechEventPayload;
    try {
      payload = JSON.parse(data) as SpeechEventPayload;
    } catch {
      throw new Error("Invalid speech stream event");
    }
    if (typeof payload.text !== "string") throw new Error("Invalid speech text");

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
    if (!streamComplete) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  if (!streamComplete || !text.trim()) throw new Error("Incomplete speech stream");
  return text;
}
