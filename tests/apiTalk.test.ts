import { afterEach, describe, expect, it, vi } from "vitest";

import handler from "../api/talk";
import { SPEECH_HISTORY_LIMIT, SPEECH_MESSAGE_MAX_CHARS } from "../src/creature/brain/speechProtocol";

function apiResponse() {
  const writes: string[] = [];
  const headers = new Map<string, string>();
  let statusCode = 200;
  let headersSent = false;
  let writableEnded = false;
  const response = {
    setHeader(name: string, value: string) { headers.set(name, value); },
    status(code: number) { statusCode = code; return response; },
    json(body: unknown) { writes.push(JSON.stringify(body)); writableEnded = true; return body; },
    write(chunk: string) { writes.push(chunk); return true; },
    end() { writableEnded = true; },
    on() { return response; },
    flushHeaders() { headersSent = true; },
    get headersSent() { return headersSent; },
    get writableEnded() { return writableEnded; },
  };
  return {
    response,
    writes,
    headers,
    get statusCode() { return statusCode; },
    get writableEnded() { return writableEnded; },
  };
}

function request(body: unknown, remoteAddress = `test-${crypto.randomUUID()}`) {
  return {
    method: "POST",
    body,
    headers: {},
    socket: { remoteAddress },
    on() {},
  };
}

function groqResponse(frames: string[]) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const validBody = {
  message: "¿Cómo estás?",
  language: "es",
  history: [
    { user: "hola", assistant: "Hola." },
    { user: "¿Qué tal?", assistant: "Bien." },
  ],
};

describe("/api/talk", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("valida longitud e historial antes de llamar a Groq", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const tooLong = apiResponse();
    await handler(request({ message: "x".repeat(SPEECH_MESSAGE_MAX_CHARS + 1), language: "es", history: [] }), tooLong.response);
    const tooMuchHistory = apiResponse();
    await handler(request({
      message: "hola",
      language: "es",
      history: Array.from({ length: SPEECH_HISTORY_LIMIT + 1 }, () => ({ user: "hola", assistant: "Hola." })),
    }), tooMuchHistory.response);

    expect(tooLong.statusCode).toBe(400);
    expect(tooMuchHistory.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "fr", "ES", 1])("rechaza idioma inválido %s antes del proveedor", async (language) => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = apiResponse();
    await handler(request({ ...validBody, language }), response.response);
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["es", "español (Spanish)"], ["en", "inglés (English)"]])("usa %s explícito sin reescribir historial", async (language, instruction) => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(groqResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Reply." } }] })}\n\n`,
      "data: [DONE]\n\n",
    ]));
    vi.stubGlobal("fetch", fetchMock);
    await handler(request({ ...validBody, language }), apiResponse().response);
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as { messages: { role: string; content: string }[] };
    expect(payload.messages[0].content).toContain(instruction);
    expect(payload.messages[1]).toEqual({ role: "user", content: "hola" });
    expect(payload.messages[2]).toEqual({ role: "assistant", content: "Hola." });
    expect(payload.messages.at(-1)?.content).toBe(validBody.message);
  });

  it("reinicia el límite al comenzar la siguiente ventana", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    const fetchMock = vi.fn().mockImplementation(() => groqResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Bien." } }] })}\n\n`,
    ]));
    vi.stubGlobal("fetch", fetchMock);
    const client = `window-${crypto.randomUUID()}`;
    for (let index = 0; index < 12; index++) await handler(request(validBody, client), apiResponse().response);
    const limited = apiResponse();
    await handler(request(validBody, client), limited.response);
    expect(limited.statusCode).toBe(429);
    clock.mockReturnValue(160_000);
    const next = apiResponse();
    await handler(request(validBody, client), next.response);
    expect(next.statusCode).toBe(200);
    expect(next.writes.join("")).toContain("event: done");
    expect(fetchMock).toHaveBeenCalledTimes(13);
  });

  it("limita solicitudes por cliente y ventana sin contactar al proveedor para la excedente", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.fn().mockImplementation(() => groqResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Listo." } }] })}\n\n`,
      "data: [DONE]\n\n",
    ]));
    vi.stubGlobal("fetch", fetchMock);
    const client = `rate-test-${crypto.randomUUID()}`;
    const results = [];

    for (let index = 0; index < 13; index += 1) {
      const response = apiResponse();
      await handler(request(validBody, client), response.response);
      results.push(response.statusCode);
    }

    expect(results.slice(0, 12)).toEqual(Array(12).fill(200));
    expect(results[12]).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it("usa bajo esfuerzo de razonamiento para GPT-OSS y transmite una respuesta SSE", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
    const fetchMock = vi.fn().mockResolvedValue(groqResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning: "privado" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Bien." } }] })}\n\n`,
      "data: [DONE]\n\n",
    ]));
    vi.stubGlobal("fetch", fetchMock);
    const response = apiResponse();

    await handler(request(validBody), response.response);

    const upstreamOptions = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(upstreamOptions.body)) as Record<string, unknown>;
    expect(payload.reasoning_effort).toBe("low");
    expect(payload.max_completion_tokens).toBe(64);
    expect(payload.messages).toHaveLength(6);
    expect(response.statusCode).toBe(200);
    expect(response.writes.join("")).toContain('event: delta\ndata: {"text":"Bien."}');
    expect(response.writes.join("")).toContain("event: done");
    expect(response.writableEnded).toBe(true);
  });

  it("no agrega opciones de razonamiento no soportadas a otros modelos Groq", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "llama-3.3-70b-versatile");
    const fetchMock = vi.fn().mockResolvedValue(groqResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Bien." } }] })}\n\n`,
      "data: [DONE]\n\n",
    ]));
    vi.stubGlobal("fetch", fetchMock);

    await handler(request(validBody), apiResponse().response);

    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload).not.toHaveProperty("reasoning_effort");
  });

  it("convierte frames upstream inválidos en un evento SSE de error", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(groqResponse(["data: not-json\n\n"])));
    const response = apiResponse();

    await handler(request(validBody), response.response);

    expect(response.statusCode).toBe(200);
    expect(response.writes.join("")).toContain("event: error");
    expect(response.writableEnded).toBe(true);
  });

  it("aborta el lector upstream al desconectarse el cliente", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream));
    vi.stubGlobal("fetch", fetchMock);
    let disconnect = () => {};
    const response = apiResponse();
    const pending = handler({ ...request(validBody), on: (_event, callback) => { disconnect = callback; } }, response.response);
    await vi.waitFor(() => expect(response.headers.get("Content-Type")).toContain("text/event-stream"));
    disconnect();
    await pending;
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(response.writes.join("")).not.toContain("event: done");
  });

  it("devuelve indisponibilidad sin llamar al proveedor cuando falta configuración", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = apiResponse();
    await handler(request(validBody), response.response);
    expect(response.statusCode).toBe(503);
    expect(response.writes.join("")).toContain("Speech unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([{ user: " ", assistant: "Respuesta." }, { user: "Hola", assistant: "" }])("rechaza intercambios vacíos del historial", async (exchange) => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = apiResponse();
    await handler(request({ ...validBody, history: [exchange] }), response.response);
    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
