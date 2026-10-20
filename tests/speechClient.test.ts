import { describe, expect, it, vi } from "vitest";

import { streamSpeechReply } from "../src/creature/brain/speechClient";

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

const callbacks = () => ({ onSpoken: vi.fn(), onBlock: vi.fn() });

describe("streamSpeechReply", () => {
  it("acota entrada, limita historial y entrega la frase y los bloques validados", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([
      event("spoken", { text: "Te cuento." }),
      event("block", { block: { type: "steps", items: ["1. Uno", "2. Dos"] } }),
      event("block", { block: { type: "html", html: "<b>x</b>" } }),
      event("done", {}),
    ].join(""), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const handlers = callbacks();
    const history = Array.from({ length: 4 }, (_, index) => ({
      user: `user-${index}`,
      assistant: `reply-${index}`,
    }));

    const reply = await streamSpeechReply({
      message: "x".repeat(400),
      language: "en",
      history,
      signal: new AbortController().signal,
      ...handlers,
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.message).toHaveLength(280);
    expect(request.language).toBe("en");
    expect(request.history).toEqual(history.slice(-2));
    expect(reply).toEqual({ spoken: "Te cuento.", blocks: [{ type: "steps", items: ["Uno", "Dos"] }] });
    expect(handlers.onSpoken).toHaveBeenCalledExactlyOnceWith("Te cuento.");
    expect(handlers.onBlock).toHaveBeenCalledExactlyOnceWith({ type: "steps", items: ["Uno", "Dos"] });
  });

  it("rechaza un evento de error del stream aunque HTTP sea 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(event("error", {}), { status: 200 })));

    await expect(streamSpeechReply({
      message: "hola",
      language: "es",
      history: [],
      signal: new AbortController().signal,
      ...callbacks(),
    })).rejects.toThrow("Speech stream failed");
  });

  it("rechaza streams incompletos o sin frase", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(event("done", {}), { status: 200 })));

    await expect(streamSpeechReply({
      message: "hola",
      language: "es",
      history: [],
      signal: new AbortController().signal,
      ...callbacks(),
    })).rejects.toThrow("Incomplete speech stream");
  });

  it.each([
    ["un bloque antes de la frase", [event("block", { block: { type: "paragraph", text: "x" } })], "Speech block before its sentence"],
    ["una segunda frase", [event("spoken", { text: "Uno." }), event("spoken", { text: "Dos." })], "Invalid speech text"],
  ])("rechaza %s", async (_case, frames, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response([...frames, event("done", {})].join(""), { status: 200 })));

    await expect(streamSpeechReply({
      message: "hola",
      language: "es",
      history: [],
      signal: new AbortController().signal,
      ...callbacks(),
    })).rejects.toThrow(message);
  });

  it("cancels a pending reader on abort and ignores late buffered events", async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { streamController = controller; }, cancel });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    const abort = new AbortController();
    const handlers = callbacks();
    const reply = streamSpeechReply({ message: "hola", language: "es", history: [], signal: abort.signal, ...handlers });
    const rejected = expect(reply).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    streamController?.enqueue(new TextEncoder().encode(event("spoken", { text: "Viejo." })));
    abort.abort();
    await rejected;
    expect(handlers.onSpoken).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });

  it("rejects invalid language before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(streamSpeechReply({ message: "hola", language: "fr" as never, history: [], signal: new AbortController().signal, ...callbacks() })).rejects.toThrow("Invalid speech language");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
