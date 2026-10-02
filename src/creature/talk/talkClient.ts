export type TalkExchange = { user: string; assistant: string };

const MAX_USER_CHARS = 280;
const MAX_REPLY_CHARS = 120;
const bounded = (text: string, maximum: number) => Array.from(text).slice(0, maximum).join("");

export async function streamTalk(
  message: string,
  history: TalkExchange[],
  signal: AbortSignal,
  onText: (text: string) => void,
) {
  const response = await fetch("/api/talk", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      message: bounded(message, MAX_USER_CHARS),
      history: history.slice(-4).map((exchange) => ({
        user: bounded(exchange.user, MAX_USER_CHARS),
        assistant: bounded(exchange.assistant, MAX_REPLY_CHARS),
      })),
    }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error("Talk request failed");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let event = "";
  let reply = "";
  let completed = false;
  const consumeLine = (line: string) => {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      return;
    }
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (event === "done") {
      completed = true;
      return;
    }
    try {
      const payload: unknown = JSON.parse(data);
      if (!payload || typeof payload !== "object" || !("text" in payload) ||
        typeof payload.text !== "string") return;
      const remaining = MAX_REPLY_CHARS - Array.from(reply).length;
      const text = bounded(payload.text, remaining);
      if (!text) return;
      reply += text;
      onText(reply);
    } catch {
      // Ignore malformed stream frames; absence of a done event makes request fail.
    }
  };

  while (!completed) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split(/\r?\n/u);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) event = "";
      else consumeLine(line);
      if (completed) break;
    }
  }
  if (!completed || !reply) throw new Error("Talk stream incomplete");
  return reply;
}
