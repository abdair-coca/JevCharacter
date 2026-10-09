import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/decide";
import { worldState } from "./helpers";

const sdk = vi.hoisted(() => ({
  systemOne: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("@typesafe-ai/sdk", () => ({
  choice: (prompt: string, options: Record<string, string>) => ({ prompt, options }),
  noul: (prompt: string, options: Record<string, string>) => ({ prompt, options }),
  score: (prompt: string, options: string[]) => ({ prompt, options }),
  TypeSafeClient: class {
    systemOne = sdk.systemOne;
  },
}));

function createResponse() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader() {},
    status(code: number) { statusCode = code; return response; },
    json(value: unknown) { body = value; return value; },
  };
  return { response, get statusCode() { return statusCode; }, get body() { return body; } };
}

describe("/api/decide QUESTION", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("lets Jev select QUESTION and keeps it a gesture instead of a binary answer", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    sdk.systemOne.mockResolvedValue({
      answers: {
        actionType: { choice: "YES", confidence: 0.83 },
        reaction: { choice: "QUESTION", confidence: 0.91, probabilities: { QUESTION: 0.91, BASE: 0.09 } },
        talkState: { choice: "Talk" },
        morphForm: { choice: "star" },
        intensity: { score: 0.5 },
        wantsAttention: { noul: 0.7 },
      },
    });
    const response = createResponse();
    const request = {
      method: "POST",
      body: { state: worldState("¿Eres gay?") },
      headers: {},
      socket: { remoteAddress: crypto.randomUUID() },
    };

    await handler(request, response.response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      action: { kind: "reaction", reaction: "QUESTION" },
      actionConfidence: 0.91,
      reaction: "QUESTION",
      probabilities: { QUESTION: 0.91 },
      source: "jev",
    });
    const input = sdk.systemOne.mock.calls[0]?.[0] as {
      questions: {
        actionType: { prompt: string };
        reaction: { prompt: string; options: Record<string, string> };
      };
    };
    expect(input.questions.actionType.prompt).toContain("¿eres gay?");
    expect(input.questions.reaction.options.QUESTION).toContain("raised eyebrow");
  });
});
