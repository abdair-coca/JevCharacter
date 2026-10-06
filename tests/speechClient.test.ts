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
      history,
      signal: new AbortController().signal,
      onText,
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(request.message).toHaveLength(280);
    expect(request.history).toEqual(history.slice(-2));
    expect(reply).toBe("Hola.");
    expect(Array.from(reply).length).toBeLessThanOrEqual(120);
    expect(onText).toHaveBeenLastCalledWith("Hola.");
  });

  it("rechaza un evento de error del stream aunque HTTP sea 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(event("error", {}), { status: 200 })));

    await expect(streamSpeechReply({
      message: "hola",
      history: [],
      signal: new AbortController().signal,
      onText: vi.fn(),
    })).rejects.toThrow("Speech stream failed");
  });

  it("rechaza streams incompletos o sin texto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(event("done", {}), { status: 200 })));

    await expect(streamSpeechReply({
      message: "hola",
      history: [],
      signal: new AbortController().signal,
      onText: vi.fn(),
    })).rejects.toThrow("Incomplete speech stream");
  });
});
