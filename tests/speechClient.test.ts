import { describe, expect, it, vi } from "vitest";

import { streamSpeechReply } from "../src/creature/brain/speechClient";

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

const callbacks = () => ({ memory: [] as string[], onSpoken: vi.fn(), onBlock: vi.fn() });

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

  it("manda la clave del visitante solo como cabecera, nunca en el cuerpo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([event("spoken", { text: "Hola." }), event("done", {})].join(""), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await streamSpeechReply({ message: "hola", language: "es", history: [], apiKey: "gsk_test_visible_key_1234567890", signal: new AbortController().signal, ...callbacks() });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ "x-groq-api-key": "gsk_test_visible_key_1234567890" });
    expect(String(init.body)).not.toContain("gsk_test_visible_key");
  });

  it("no envía cabecera de clave cuando el visitante no ha guardado ninguna", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([event("spoken", { text: "Hola." }), event("done", {})].join(""), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await streamSpeechReply({ message: "hola", language: "es", history: [], apiKey: null, signal: new AbortController().signal, ...callbacks() });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty("x-groq-api-key");
  });

  it("envía las notas elegidas y devuelve solo la primera nota válida, sin mostrarla", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([
      event("spoken", { text: "Te cuento." }),
      event("memory", { text: "Le interesa la tecnología." }),
      event("memory", { text: "Otra nota." }),
      event("done", {}),
    ].join(""), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const handlers = { ...callbacks(), memory: ["Estudia en Potosí."] };

    const reply = await streamSpeechReply({ message: "hola", language: "es", history: [], signal: new AbortController().signal, ...handlers });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).memory).toEqual(["Estudia en Potosí."]);
    expect(reply).toEqual({ spoken: "Te cuento.", blocks: [], memory: "Le interesa la tecnología." });
    expect(handlers.onBlock).not.toHaveBeenCalled();
  });

  it("descarta una nota con números largos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response([
      event("spoken", { text: "Anotado." }),
      event("memory", { text: "Su celular es 712 345 67." }),
      event("done", {}),
    ].join(""), { status: 200 })));

    const reply = await streamSpeechReply({ message: "hola", language: "es", history: [], signal: new AbortController().signal, ...callbacks() });

    expect(reply).toEqual({ spoken: "Anotado.", blocks: [] });
    expect("memory" in reply).toBe(false);
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
