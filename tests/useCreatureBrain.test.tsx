// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CharacterController } from "../src/character/useCharacterController";
import { useCreatureBrain } from "../src/hooks/useCreatureBrain";
import type { SensorController } from "../src/creature/sensors/pointerSensor";
import { decision, jsonResponse, sensorSnapshot } from "./helpers";

afterEach(cleanup);

function createCharacter() {
  return {
    think: vi.fn(),
    talk: vi.fn(),
    idle: vi.fn(),
    morph: vi.fn(),
    answer: vi.fn(),
    play: vi.fn(),
    playFor: vi.fn(),
    sequence: vi.fn(),
    stop: vi.fn(),
    bump: vi.fn(),
    hello: vi.fn(),
    ghost: vi.fn(),
    flower: vi.fn(),
    cloud: vi.fn(),
  } as unknown as CharacterController;
}

function createSensors(): SensorController {
  return {
    getSnapshot: () => sensorSnapshot(),
    markContextInteraction: vi.fn(),
  };
}

function mountBrain(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const character = createCharacter();
  const sensors = createSensors();
  const characterRef = { current: character } as RefObject<CharacterController | null>;
  const rendered = renderHook(() => useCreatureBrain(sensors, characterRef));
  return { ...rendered, character };
}

describe("useCreatureBrain talk flow", () => {
  it("replaces partial Groq text with the fallback when the SSE stream errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/decide") {
        return jsonResponse(decision({ kind: "talk", state: "talkb" }));
      }
      if (String(input) === "/api/talk") {
        return new Response([
          "event: delta\ndata: {\"text\":\"Parcial\"}\n\n",
          "event: error\ndata: {}\n\n",
        ].join(""), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${String(input)}`);
    });
    const { result, character, unmount } = mountBrain(fetchMock);

    act(() => result.current.submitContext("Explícame esto"));

    await waitFor(() => {
      expect(result.current.speechCaption?.text).toBe("No pude responder ahora. Inténtalo de nuevo.");
    });
    expect(character.think).toHaveBeenCalledOnce();
    expect(character.talk).toHaveBeenCalledWith("talkb");
    expect(character.idle).toHaveBeenCalled();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(["/api/decide", "/api/talk"]);
    unmount();
  });

  it("aborts a pending reply when newer context arrives and ignores stale output", async () => {
    let talkSignal: AbortSignal | undefined;
    let decisionCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input) === "/api/decide") {
        decisionCount += 1;
        return Promise.resolve(jsonResponse(decisionCount === 1
          ? decision({ kind: "talk", state: "Talk" })
          : decision()));
      }
      if (String(input) === "/api/talk") {
        talkSignal = options?.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          talkSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${String(input)}`));
    });
    const { result, unmount } = mountBrain(fetchMock);

    act(() => result.current.submitContext("Primer contexto"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/talk", expect.any(Object)));
    expect(talkSignal?.aborted).toBe(false);

    act(() => result.current.submitContext("Contexto nuevo"));

    await waitFor(() => expect(decisionCount).toBe(2));
    await waitFor(() => expect(talkSignal?.aborted).toBe(true));
    expect(result.current.speechCaption).toBeNull();
    expect(result.current.decision.action).toEqual({ kind: "reaction", reaction: "BASE" });
    unmount();
  });

  it("runs a selected morph without calling Groq, while explicit form wins", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse(decision({ kind: "morph", form: "square" })));
    const { result, character, unmount } = mountBrain(fetchMock);

    act(() => result.current.submitContext("Morph into a triangle"));

    await waitFor(() => expect(character.morph).toHaveBeenCalledWith("triangle"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/decide");
    unmount();
  });

  it("executes visual yes/no decisions without requesting speech", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse(decision({ kind: "answer", answer: "yes" })));
    const { result, character, unmount } = mountBrain(fetchMock);

    act(() => result.current.submitContext("¿Es correcto?"));

    await waitFor(() => expect(character.answer).toHaveBeenCalledWith("yes"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/decide");
    unmount();
  });
});
