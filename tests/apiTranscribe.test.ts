import { afterEach, describe, expect, it, vi } from "vitest";

import handler from "../api/transcribe";
import { GROQ_KEY_HEADER } from "../src/creature/brain/speechProtocol";
import { LISTEN_SAMPLE_RATE, LISTEN_SEGMENT_MAX_MS } from "../src/creature/listen/listenProtocol";
import { encodeWav } from "../src/creature/listen/wav";

const TEST_GROQ_KEY = "gsk_test_visible_key_1234567890";
const phrase = (ms = 1000, sampleRate = LISTEN_SAMPLE_RATE) =>
  Buffer.from(encodeWav(new Float32Array(Math.round((sampleRate * ms) / 1000)).fill(0.2), sampleRate)).toString("base64");

function apiResponse() {
  const result = { statusCode: 200, body: undefined as unknown, headers: new Map<string, string>() };
  const response = {
    setHeader(name: string, value: string) { result.headers.set(name, value); },
    status(code: number) { result.statusCode = code; return response; },
    json(body: unknown) { result.body = body; return body; },
  };
  return { response, result };
}

function request(body: unknown, headers: Record<string, string> = { [GROQ_KEY_HEADER]: TEST_GROQ_KEY }, method = "POST") {
  return { method, body, headers, socket: { remoteAddress: `test-${crypto.randomUUID()}` } };
}

async function call(body: unknown, headers?: Record<string, string>, method?: string) {
  const { response, result } = apiResponse();
  await handler(request(body, headers, method), response);
  return result;
}

function groqReturns(body: unknown, status = 200) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("/api/transcribe", () => {
  it("forwards the phrase to Groq Whisper with the visitor's key, language and Jev's name as a hint", async () => {
    const fetchMock = groqReturns({ text: " Jev, ¿qué carreras puedo estudiar? " });
    const result = await call({ audio: phrase(), language: "es" });

    expect(result).toMatchObject({ statusCode: 200, body: { text: "Jev, ¿qué carreras puedo estudiar?" } });
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect(init.headers).toEqual({ Authorization: `Bearer ${TEST_GROQ_KEY}` });
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("language")).toBe("es");
    expect(form.get("prompt")).toBe("Jev");
    expect(form.get("response_format")).toBe("verbose_json");
    const file = form.get("file") as File;
    expect(file.type).toBe("audio/wav");
    expect(file.size).toBe(Buffer.from(phrase(), "base64").length);
  });

  it("drops the segments Whisper rates as silence", async () => {
    groqReturns({
      text: " Jev, hola. Gracias por ver el video.",
      segments: [{ text: " Jev, hola.", no_speech_prob: 0.05 }, { text: " Gracias por ver el video.", no_speech_prob: 0.93 }],
    });
    expect((await call({ audio: phrase(), language: "es" })).body).toEqual({ text: "Jev, hola." });
  });

  it("asks for a key before calling Groq", async () => {
    const fetchMock = groqReturns({ text: "hola" });
    expect((await call({ audio: phrase(), language: "es" }, {})).statusCode).toBe(401);
    expect((await call({ audio: phrase(), language: "es" }, { [GROQ_KEY_HEADER]: "short" })).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["no audio", { language: "es" }],
    ["an unknown language", { audio: phrase(), language: "fr" }],
    ["an extra field", { audio: phrase(), language: "es", model: "whisper-large-v3" }],
    ["text that is not base64", { audio: "not base64!", language: "es" }],
    ["too short a phrase", { audio: phrase(200), language: "es" }],
    ["too long a phrase", { audio: phrase(LISTEN_SEGMENT_MAX_MS + 500), language: "es" }],
    ["another sample rate", { audio: phrase(1000, 44_100), language: "es" }],
    ["a file that is not WAV", { audio: Buffer.from("ID3".padEnd(20_000, "x")).toString("base64"), language: "es" }],
  ])("rejects %s", async (_case, body) => {
    const fetchMock = groqReturns({ text: "hola" });
    expect((await call(body)).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only accepts POST", async () => {
    expect((await call({}, undefined, "GET")).statusCode).toBe(405);
  });

  it.each([[401, 401], [429, 429], [500, 502]])("maps a Groq %i to %i", async (upstream, status) => {
    groqReturns({ error: "nope" }, upstream);
    expect((await call({ audio: phrase(), language: "en" })).statusCode).toBe(status);
  });

  it("answers 502 when Groq cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect((await call({ audio: phrase(), language: "en" })).statusCode).toBe(502);
  });
});
