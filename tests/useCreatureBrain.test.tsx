// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CharacterController } from "../src/character/useCharacterController";
import { useCreatureBrain } from "../src/hooks/useCreatureBrain";
import type { SensorController } from "../src/creature/sensors/pointerSensor";
import { decision, jsonResponse, sensorSnapshot } from "./helpers";
import type { SpeechLanguage } from "../src/creature/brain/speechProtocol";

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
  it("uses the latest language if it changes while the decision is still pending", async () => {
    let resolveDecision: (response: Response) => void = () => {};
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      if (String(url) === "/api/decide") return new Promise<Response>(resolve => { resolveDecision = resolve; });
      return Promise.resolve(new Response('event: delta\ndata: {"text":"Hello."}\n\nevent: done\ndata: {}\n\n'));
    });
    vi.stubGlobal("fetch", fetchMock);
    const characterRef = { current: createCharacter() };
    const sensors = createSensors();
    const initialProps: { language: SpeechLanguage } = { language: "es" };
    const { result, rerender, unmount } = renderHook(({ language }) => useCreatureBrain(sensors, characterRef, { language }), { initialProps });
    act(() => result.current.submitContext("Un mensaje en español"));
    rerender({ language: "en" });
    await act(async () => resolveDecision(jsonResponse(decision({ kind: "talk", state: "Talk" }))));
    await waitFor(() => expect(result.current.speechCaption?.text).toBe("Hello."));
    expect(fetchMock).toHaveBeenCalledWith("/api/talk", expect.objectContaining({ body: expect.stringContaining('"language":"en"') }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("suspends all brain timers, rejects hidden submissions, and retains context on resume", async () => {
    vi.useFakeTimers();
    let resolveOld: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const character = createCharacter();
    const sensors = createSensors();
    const characterRef = { current: character };
    const { result, rerender, unmount } = renderHook(({ active }) => useCreatureBrain(sensors, characterRef, { active, language: "en" }), { initialProps: { active: true } });
    act(() => result.current.submitContext("Keep this in memory"));
    rerender({ active: false });
    // jsdom enqueues a 0ms storage event when suspension saves personality.
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(vi.getTimerCount()).toBe(0);
    const personality = result.current.personality;
    act(() => result.current.submitContext("Hidden context"));
    await act(async () => { resolveOld(jsonResponse(decision({ kind: "talk", state: "Talk" }))); await vi.advanceTimersByTimeAsync(10000); });
    expect(result.current.userContext).toBe("Keep this in memory");
    expect(result.current.personality).toBe(personality);
    expect(result.current.speechCaption).toBeNull();
    expect(result.current.speechNotice).toBeNull();
    expect(result.current.decisionInterrupted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ active: true });
    expect(result.current.userContext).toBe("Keep this in memory");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears partial Groq text and exposes a status instead of an invented reply", async () => {
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
      expect(result.current.speechNotice).toBe("unavailable");
    });
    expect(character.think).toHaveBeenCalledOnce();
    expect(result.current.speechCaption).toBeNull();
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
