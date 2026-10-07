// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, type ReactNode } from "react";
import type { CharacterController } from "../src/character/useCharacterController";
import { useSpeechSession } from "../src/hooks/useSpeechSession";
import { streamSpeechReply } from "../src/creature/brain/speechClient";
import { SPEECH_REQUEST_TIMEOUT_MS, type SpeechLanguage } from "../src/creature/brain/speechProtocol";

vi.mock("../src/creature/brain/speechClient", () => ({ streamSpeechReply: vi.fn() }));
type Request = { options: Parameters<typeof streamSpeechReply>[0]; resolve: (text: string) => void; reject: (error: Error) => void };
let requests: Request[];
beforeEach(() => {
  requests = [];
  vi.mocked(streamSpeechReply).mockImplementation(options => new Promise((resolve, reject) => { requests.push({ options, resolve, reject }); }));
});
afterEach(cleanup);

function mountSpeech(strict = false) {
  const character = { think: vi.fn(), talk: vi.fn(), idle: vi.fn() } as unknown as CharacterController;
  const ref = { current: character };
  const initialProps: { language: SpeechLanguage; active: boolean } = { language: "es", active: true };
  const rendered = renderHook(props => useSpeechSession(ref, props.language, props.active), {
    initialProps,
    ...(strict ? { wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> } : {}),
  });
  return { ...rendered, character };
}

async function complete(request: Request, text: string) {
  await act(async () => { request.options.onText(text); request.resolve(text); });
}

describe("speech session generations", () => {
  it("regenerates the same message in the latest language and excludes stale fragments/history", async () => {
    const { result, rerender } = mountSpeech();
    act(() => result.current.start("Mi mensaje original", "talkb"));
    act(() => requests[0].options.onText("Fragmento viejo"));
    expect(result.current.caption?.text).toBe("Fragmento viejo");
    rerender({ language: "en", active: true });
    expect(requests[0].options.signal.aborted).toBe(true);
    expect(requests[1].options).toMatchObject({ message: "Mi mensaje original", language: "en", history: [] });
    expect(result.current.caption).toBeNull();
    expect(result.current.notice).toBe("regenerating");
    await complete(requests[0], "Respuesta vieja.");
    expect(result.current.caption).toBeNull();
    await complete(requests[1], "New answer.");
    expect(result.current.caption).toMatchObject({ text: "New answer.", complete: true, language: "en" });
    act(() => result.current.start("Siguiente mensaje", "Talk"));
    expect(requests[2].options.history).toEqual([{ user: "Mi mensaje original", assistant: "New answer." }]);
  });

  it("handles rapid ES/EN changes without replaying completed exchanges", async () => {
    const { result, rerender } = mountSpeech();
    act(() => result.current.start("Primero", "Talk"));
    await complete(requests[0], "Primera respuesta.");
    rerender({ language: "en", active: true });
    expect(requests).toHaveLength(1);
    expect(result.current.caption?.language).toBe("es");
    act(() => result.current.start("Segundo", "Talk"));
    rerender({ language: "es", active: true });
    rerender({ language: "en", active: true });
    expect(requests).toHaveLength(4);
    expect(requests[1].options.signal.aborted).toBe(true);
    expect(requests[2].options.signal.aborted).toBe(true);
    await complete(requests[3], "Final reply.");
    act(() => result.current.start("Tercero", "Talk"));
    expect(requests[4].options.history).toEqual([
      { user: "Primero", assistant: "Primera respuesta." },
      { user: "Segundo", assistant: "Final reply." },
    ]);
  });

  it("suspends in-flight work and never regenerates on another route or replays it on return", async () => {
    vi.useFakeTimers();
    const { result, rerender } = mountSpeech();
    act(() => result.current.start("Completo", "Talk"));
    await complete(requests[0], "Guardado.");
    act(() => result.current.start("En curso", "Talk"));
    rerender({ language: "es", active: false });
    expect(requests[1].options.signal.aborted).toBe(true);
    expect(result.current.notice).toBe("interrupted");
    expect(vi.getTimerCount()).toBe(0);
    rerender({ language: "en", active: false });
    await complete(requests[1], "Obsoleto.");
    rerender({ language: "en", active: true });
    expect(requests).toHaveLength(2);
    expect(result.current.caption).toBeNull();
    act(() => result.current.start("De vuelta", "Talk"));
    expect(requests[2].options.history).toEqual([{ user: "Completo", assistant: "Guardado." }]);
    expect(requests[2].options.language).toBe("en");
  });

  it("clears the full conversation and an active generation without accepting late completion", async () => {
    const { result } = mountSpeech();
    act(() => result.current.start("Privado", "Talk"));
    await complete(requests[0], "Respuesta privada.");
    act(() => result.current.start("Pendiente", "Talk"));
    act(() => result.current.cancel(true));
    expect(requests[1].options.signal.aborted).toBe(true);
    await complete(requests[1], "No conservar.");
    act(() => result.current.start("Nuevo", "Talk"));
    expect(requests[2].options.history).toEqual([]);
  });

  it("reports failures separately from captions and does not add failed text to history", async () => {
    const { result, character } = mountSpeech();
    act(() => result.current.start("Pregunta", "Talk"));
    act(() => requests[0].options.onText("Incompleto"));
    await act(async () => requests[0].reject(new Error("Stream error")));
    expect(result.current.caption).toBeNull();
    expect(result.current.notice).toBe("unavailable");
    expect(character.idle).toHaveBeenCalled();
    act(() => result.current.start("Otra", "Talk"));
    expect(requests[1].options.history).toEqual([]);
  });

  it("times out unresponsive speech and cancels every timer on teardown", async () => {
    vi.useFakeTimers();
    const { result, unmount } = mountSpeech();
    act(() => result.current.start("Espera", "Talk"));
    act(() => vi.advanceTimersByTime(SPEECH_REQUEST_TIMEOUT_MS));
    expect(requests[0].options.signal.aborted).toBe(true);
    expect(result.current.notice).toBe("unavailable");
    act(() => result.current.start("Nueva", "Talk"));
    await complete(requests[1], "Terminada.");
    act(() => result.current.onCaptionRevealed(result.current.caption!.generation));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("remains usable after StrictMode's setup/cleanup cycle", async () => {
    const { result } = mountSpeech(true);
    act(() => result.current.start("Hola", "Talk"));
    await complete(requests[0], "Hola.");
    expect(result.current.caption?.text).toBe("Hola.");
  });
});
