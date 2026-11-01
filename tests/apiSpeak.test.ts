import { afterEach, describe, expect, it, vi } from "vitest";

import handler from "../api/speak";
import { GEMINI_KEY_HEADER } from "../src/creature/brain/speechProtocol";

const KEY = "AIza_test_visible_key_1234567890";

function apiResponse() {
  const result = { statusCode: 200, body: undefined as unknown, chunks: [] as Uint8Array[], headers: new Map<string, string>(), ended: false, flushed: false };
  const response = {
    setHeader(name: string, value: string) { result.headers.set(name, value); },
    status(code: number) { result.statusCode = code; return response; },
    json(body: unknown) { result.body = body; result.ended = true; return body; },
    write(chunk: Uint8Array) { result.chunks.push(chunk); return true; },
    end() { result.ended = true; },
    on() { return response; },
    flushHeaders() { result.flushed = true; },
    get headersSent() { return result.flushed; },
    get writableEnded() { return result.ended; },
  };
  return { response, result };
}

async function call(body: unknown, headers: Record<string, string> = { [GEMINI_KEY_HEADER]: KEY }, method = "POST") {
  const { response, result } = apiResponse();
  await handler({ method, body, headers, socket: { remoteAddress: `test-${crypto.randomUUID()}` }, on() {} }, response);
  return result;
}

const audioEvent = (bytes: number[]) =>
  `data: ${JSON.stringify({ event_type: "step.delta", delta: { type: "audio", data: Buffer.from(bytes).toString("base64") } })}\n\n`;

function googleStreams(frames: string[], status = 200) {
  const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  }), { status })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("/api/speak", () => {
  it("asks Gemini for Puck's voice in Jev's style and streams the PCM it returns", async () => {
    const fetchMock = googleStreams([audioEvent([1, 2, 3, 4]), 'data: {"event_type":"step.start"}\n\n', audioEvent([5, 6])]);
    const result = await call({ text: "¡Hola, amigo!", language: "es" });

    expect(result.statusCode).toBe(200);
    expect(result.headers.get("Content-Type")).toBe("audio/L16;rate=24000;channels=1");
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(result.chunks.map(chunk => Array.from(chunk))).toEqual([[1, 2, 3, 4], [5, 6]]);
    expect(result.ended).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(init?.headers).toMatchObject({ "x-goog-api-key": KEY });
    const upstream = JSON.parse(String(init?.body));
    expect(upstream).toMatchObject({
      model: "gemini-3.8-flash-lite-tts",
      stream: true,
      response_format: { type: "audio", mime_type: "audio/l16", sample_rate: 24000 },
      generation_config: { speech_config: [{ voice: "Puck" }] },
    });
    const [content] = upstream.input[0].content;
    expect(content.text).toBe("¡Hola, amigo!");
    expect(content.annotations[0].type).toBe("speech_metadata");
    expect(content.annotations[0].style).toContain("sin exagerar la entonación");
  });

  it("styles English in English and follows the configured model and voice", async () => {
    vi.stubEnv("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts");
    vi.stubEnv("GEMINI_TTS_VOICE", "Leda");
    const fetchMock = googleStreams([audioEvent([1, 2])]);
    await call({ text: "Hello!", language: "en" });
    const upstream = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(upstream.model).toBe("gemini-3.8-flash-tts");
    expect(upstream.generation_config.speech_config).toEqual([{ voice: "Leda" }]);
    expect(upstream.input[0].content[0].annotations[0].style).toContain("without exaggerated intonation");
  });

  it("joins an event split across network chunks", async () => {
    const event = audioEvent([9, 8, 7, 6]);
    googleStreams([event.slice(0, 20), event.slice(20)]);
    expect((await call({ text: "Hola.", language: "es" })).chunks.map(chunk => Array.from(chunk))).toEqual([[9, 8, 7, 6]]);
  });

  it("asks for a key before calling Google", async () => {
    const fetchMock = googleStreams([audioEvent([1, 2])]);
    expect((await call({ text: "Hola.", language: "es" }, {})).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["no text", { language: "es" }],
    ["blank text", { text: "   ", language: "es" }],
    ["text longer than a spoken sentence", { text: "a".repeat(121), language: "es" }],
    ["an unknown language", { text: "Bonjour.", language: "fr" }],
    ["an extra field", { text: "Hola.", language: "es", voice: "Kore" }],
  ])("rejects %s", async (_case, body) => {
    const fetchMock = googleStreams([audioEvent([1, 2])]);
    expect((await call(body)).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only accepts POST", async () => {
    expect((await call({}, undefined, "GET")).statusCode).toBe(405);
  });

  it.each([[400, 401], [403, 401], [429, 429], [500, 502]])("maps a Google %i to %i before any audio", async (upstream, status) => {
    googleStreams(['{"error":{}}'], upstream);
    const result = await call({ text: "Hola.", language: "es" });
    expect(result.statusCode).toBe(status);
    expect(result.flushed).toBe(false);
  });

  it("answers 502 when the stream brings no audio", async () => {
    googleStreams(['data: {"event_type":"step.start"}\n\n', "data: [DONE]\n\n"]);
    const result = await call({ text: "Hola.", language: "es" });
    expect(result.statusCode).toBe(502);
    expect(result.chunks).toEqual([]);
  });

  it("answers 502 when Google cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect((await call({ text: "Hola.", language: "es" })).statusCode).toBe(502);
  });
});
