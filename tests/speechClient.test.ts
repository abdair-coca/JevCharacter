import { describe, expect, it, vi } from "vitest";

import { streamSpeechReply } from "../src/creature/brain/speechClient";

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("streamSpeechReply", () => {
  it("acota entrada e texto, limita historial y consume deltas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([
      event("delta", { text: "Hola" }),
      event("delta", { text: ". Una segunda frase." }),
      event("done", {}),
    ].join(""), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onText = vi.fn();
    const history = Array.from({ length: 4 }, (_, index) => ({
      user: `user-${index}`,
      assistant: `reply-${index}`,
    }));

    const reply = await streamSpeechReply({
      message: "x".repeat(400),
      language: "en",
      history,
      signal: new AbortController().signal,
      onText,
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.message).toHaveLength(280);
    expect(request.language).toBe("en");
    expect(request.history).toEqual(history.slice(-2));
    expect(reply).toBe("Hola.");
    expect(Array.from(reply).length).toBeLessThanOrEqual(120);
    expect(onText).toHaveBeenLastCalledWith("Hola.");
  });

  it("rechaza un evento de error del stream aunque HTTP sea 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(event("error", {}), { status: 200 })));

    await expect(streamSpeechReply({
      message: "hola",
      language: "es",
      history: [],
      signal: new AbortController().signal,
      onText: vi.fn(),
    })).rejects.toThrow("Speech stream failed");
  });

  it("rechaza streams incompletos o sin texto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(event("done", {}), { status: 200 })));

    await expect(streamSpeechReply({
      message: "hola",
      language: "es",
      history: [],
      signal: new AbortController().signal,
      onText: vi.fn(),
    })).rejects.toThrow("Incomplete speech stream");
  });

  it("cancels a pending reader on abort and ignores late buffered deltas", async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { streamController = controller; }, cancel });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    const abort = new AbortController();
    const onText = vi.fn();
    const reply = streamSpeechReply({ message: "hola", language: "es", history: [], signal: abort.signal, onText });
    const rejected = expect(reply).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    streamController?.enqueue(new TextEncoder().encode(event("delta", { text: "Viejo" })));
    abort.abort();
    await rejected;
    expect(onText).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });

  it("rejects invalid language before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(streamSpeechReply({ message: "hola", language: "fr" as never, history: [], signal: new AbortController().signal, onText: vi.fn() })).rejects.toThrow("Invalid speech language");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
