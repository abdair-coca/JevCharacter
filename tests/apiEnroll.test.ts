import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import handler from "../api/enroll";

function apiResponse() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader() {},
    status(code: number) { statusCode = code; return response; },
    json(value: unknown) { body = value; return value; },
  };
  return { response, get statusCode() { return statusCode; }, get body() { return body; } };
}

function request(body: unknown, remoteAddress = `test-${crypto.randomUUID()}`, method = "POST") {
  return { method, body, headers: {}, socket: { remoteAddress } };
}

const valid = { name: "  María Ejemplo ", phone: "+591 7123-4567", consent: true, language: "es" };

describe("/api/enroll", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co/");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test_key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("inserts the trimmed name, the normalized phone and the language with the server's secret key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = apiResponse();
    await handler(request(valid), result.response);
    expect(result.statusCode).toBe(201);
    expect(result.body).toEqual({ saved: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co/rest/v1/enrollments");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ apikey: "sb_secret_test_key", Prefer: "return=minimal" });
    expect(JSON.parse(String(init?.body))).toEqual({ name: "María Ejemplo", phone: "71234567", language: "es" });
  });

  it.each<[string, unknown]>([
    ["without consent", { ...valid, consent: false }],
    ["with an invalid phone", { ...valid, phone: "1234" }],
    ["without a name", { ...valid, name: "   " }],
    ["with a name over 120 characters", { ...valid, name: "x".repeat(121) }],
    ["with an unknown language", { ...valid, language: "fr" }],
    ["with extra fields", { ...valid, email: "maria@example.com" }],
    ["that is not an object", "María Ejemplo"],
  ])("rejects a request %s before calling Supabase", async (_label, body) => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const result = apiResponse();
    await handler(request(body), result.response);
    expect(result.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 503 without calling anyone while Supabase is not configured", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const result = apiResponse();
    await handler(request(valid), result.response);
    expect(result.statusCode).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports 502 when Supabase refuses the row or cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 401 })));
    const refused = apiResponse();
    await handler(request(valid), refused.response);
    expect(refused.statusCode).toBe(502);

    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed")));
    const unreachable = apiResponse();
    await handler(request(valid), unreachable.response);
    expect(unreachable.statusCode).toBe(502);
  });

  it("accepts only POST", async () => {
    const result = apiResponse();
    await handler(request(valid, undefined, "GET"), result.response);
    expect(result.statusCode).toBe(405);
  });

  it("limits repeated enrollments from the same address", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 201 })));
    const address = `test-${crypto.randomUUID()}`;
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const result = apiResponse();
      await handler(request(valid, address), result.response);
      statuses.push(result.statusCode);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});
