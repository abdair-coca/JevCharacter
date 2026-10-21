// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, type ReactNode } from "react";
import type { CharacterController } from "../src/character/useCharacterController";
import { useSpeechSession } from "../src/hooks/useSpeechSession";
import type { SpeechBlock } from "../src/creature/brain/speechBlocks";
import { streamSpeechReply, type SpeechResult } from "../src/creature/brain/speechClient";
import { addMemory, readMemory } from "../src/creature/memory/memoryStore";
import { SPEECH_REQUEST_TIMEOUT_MS, type SpeechLanguage } from "../src/creature/brain/speechProtocol";

vi.mock("../src/creature/brain/speechClient", () => ({ streamSpeechReply: vi.fn() }));
type Request = { options: Parameters<typeof streamSpeechReply>[0]; resolve: (reply: SpeechResult) => void; reject: (error: Error) => void };
let requests: Request[];
beforeEach(() => {
  requests = [];
  window.localStorage.clear();
  vi.mocked(streamSpeechReply).mockImplementation(options => new Promise((resolve, reject) => { requests.push({ options, resolve, reject }); }));
});
afterEach(cleanup);

function mountSpeech(strict = false) {
  const character = { think: vi.fn(), talk: vi.fn(), speak: vi.fn(), idle: vi.fn() } as unknown as CharacterController;
  const ref = { current: character };
  const initialProps: { language: SpeechLanguage; active: boolean } = { language: "es", active: true };
  const rendered = renderHook(props => useSpeechSession(ref, props.language, props.active), {
    initialProps,
    ...(strict ? { wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> } : {}),
  });
  return { ...rendered, character };
}

async function complete(request: Request, spoken: string, blocks: SpeechBlock[] = []) {
  await act(async () => {
    request.options.onSpoken(spoken);
    for (const block of blocks) request.options.onBlock(block);
    request.resolve({ spoken, blocks });
  });
}

describe("speech session memory", () => {
  it("sends the relevant notes and keeps the note of a finished reply for later visits", async () => {
    addMemory("Le gusta la programación.", 1);
    const { result } = mountSpeech();
    act(() => result.current.start("¿Qué carrera de programación estudio?", "Talk"));
    expect(requests[0].options.memory).toEqual(["Le gusta la programación."]);
    await act(async () => {
      requests[0].options.onSpoken("Te ayudo.");
      requests[0].resolve({ spoken: "Te ayudo.", blocks: [], memory: "Busca una carrera de programación." });
    });
    expect(readMemory().map(note => note.text)).toEqual(["Le gusta la programación.", "Busca una carrera de programación."]);
  });

  it("keeps no note from a cancelled reply and keeps memory when the conversation is cleared", async () => {
    addMemory("Le gusta la programación.", 1);
    const { result } = mountSpeech();
    act(() => result.current.start("Hola", "Talk"));
    act(() => result.current.cancel(true));
    await act(async () => requests[0].resolve({ spoken: "Tarde.", blocks: [], memory: "No guardar." }));
    expect(readMemory().map(note => note.text)).toEqual(["Le gusta la programación."]);
  });
});

describe("speech session talk hold", () => {
  it("holds the talk state from the spoken sentence until the voice reports the end", async () => {
    const { result, character } = mountSpeech();
    act(() => result.current.start("Hola", "talkb"));
    act(() => requests[0].options.onSpoken("Hola, ¿cómo estás?"));
    act(() => requests[0].options.onBlock({ type: "paragraph", text: "Detalle." }));
    expect(character.speak).toHaveBeenCalledOnce();
    expect(character.speak).toHaveBeenCalledWith("talkb");
    expect(character.talk).not.toHaveBeenCalled();
    expect(character.idle).not.toHaveBeenCalled();
    act(() => requests[0].resolve({ spoken: "Hola, ¿cómo estás?", blocks: [{ type: "paragraph", text: "Detalle." }] }));
    await act(async () => {});
    expect(character.idle).not.toHaveBeenCalled();
    act(() => result.current.finishTalk());
    expect(character.idle).toHaveBeenCalledOnce();
  });

  it("returns Jev to Base when the reply is cancelled mid-talk", () => {
    const { result, character } = mountSpeech();
    act(() => result.current.start("Hola", "Talk"));
    act(() => requests[0].options.onSpoken("Hola."));
    act(() => result.current.cancel());
    expect(requests[0].options.signal.aborted).toBe(true);
    expect(character.idle).toHaveBeenCalledOnce();
  });
});

describe("speech session generations", () => {
  it("regenerates the same message in the latest language and excludes stale fragments/history", async () => {
    const { result, rerender } = mountSpeech();
    act(() => result.current.start("Mi mensaje original", "talkb"));
    act(() => requests[0].options.onSpoken("Frase vieja."));
    expect(result.current.caption?.text).toBe("Frase vieja.");
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
    act(() => requests[0].options.onSpoken("Incompleto."));
    act(() => requests[0].options.onBlock({ type: "paragraph", text: "Parcial." }));
    await act(async () => requests[0].reject(new Error("Stream error")));
    expect(result.current.caption).toBeNull();
    expect(result.current.detail).toBeNull();
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

describe("speech session blocks", () => {
  const steps: SpeechBlock = { type: "steps", items: ["Uno", "Dos"] };
  const chips: SpeechBlock = { type: "chips", items: ["¿Más?"] };

  it("streams blocks apart from the spoken caption and keeps a digest in history", async () => {
    const { result } = mountSpeech();
    act(() => result.current.start("Pasos", "Talk"));
    act(() => requests[0].options.onSpoken("Te cuento."));
    const caption = result.current.caption;
    act(() => requests[0].options.onBlock(steps));
    expect(result.current.caption).toBe(caption);
    expect(result.current.detail).toMatchObject({ blocks: [steps], complete: false, language: "es" });
    expect(result.current.status).toBe("streaming");
    act(() => requests[0].options.onBlock(chips));
    act(() => requests[0].resolve({ spoken: "Te cuento.", blocks: [steps, chips] }));
    await act(async () => {});
    expect(result.current.detail).toMatchObject({ blocks: [steps, chips], complete: true });
    expect(result.current.status).toBe("idle");
    act(() => result.current.start("Otra", "Talk"));
    expect(result.current.detail).toBeNull();
    expect(requests[1].options.history).toEqual([{ user: "Pasos", assistant: "Te cuento.\nUno; Dos" }]);
  });

  it("drops the blocks of a cancelled or regenerated reply", async () => {
    const { result, rerender } = mountSpeech();
    act(() => result.current.start("Pasos", "Talk"));
    act(() => requests[0].options.onSpoken("Te cuento."));
    act(() => requests[0].options.onBlock(steps));
    rerender({ language: "en", active: true });
    expect(result.current.detail).toBeNull();
    act(() => requests[0].options.onBlock(chips));
    expect(result.current.detail).toBeNull();
    await complete(requests[1], "Here you go.", [chips]);
    expect(result.current.detail).toMatchObject({ blocks: [chips], language: "en" });
    act(() => result.current.cancel(true));
    expect(result.current.detail).toBeNull();
  });

  it("leaves no detail for a reply without blocks", async () => {
    const { result } = mountSpeech();
    act(() => result.current.start("Hola", "Talk"));
    await complete(requests[0], "Hola.");
    expect(result.current.caption?.text).toBe("Hola.");
    expect(result.current.detail).toBeNull();
  });
});

describe("speech session dismissal", () => {
  it("dismisses a streaming reply and ignores its late blocks and completion", async () => {
    const { result } = mountSpeech();
    act(() => result.current.start("Pasos", "Talk"));
    act(() => requests[0].options.onSpoken("Te cuento."));
    act(() => requests[0].options.onBlock({ type: "paragraph", text: "Uno." }));
    const generation = result.current.detail!.generation;
    act(() => result.current.dismissDetail(generation));
    expect(result.current.detail).toBeNull();
    expect(result.current.caption).toBeNull();
    act(() => requests[0].options.onBlock({ type: "paragraph", text: "Dos." }));
    act(() => requests[0].resolve({ spoken: "Te cuento.", blocks: [{ type: "paragraph", text: "Uno." }, { type: "paragraph", text: "Dos." }] }));
    await act(async () => {});
    expect(result.current.detail).toBeNull();
    act(() => result.current.start("Siguiente", "Talk"));
    expect(requests[1].options.history).toEqual([{ user: "Pasos", assistant: "Te cuento.\nUno. Dos." }]);
  });

  it("ignores a dismissal of an older generation", async () => {
    const { result } = mountSpeech();
    act(() => result.current.start("Pasos", "Talk"));
    await complete(requests[0], "Te cuento.", [{ type: "paragraph", text: "Uno." }]);
    act(() => result.current.dismissDetail(result.current.detail!.generation - 1));
    expect(result.current.detail).toMatchObject({ spoken: "Te cuento." });
  });
});

describe("speech session suspension", () => {
  it("clears a reply card when Home is suspended (route change or UATF form)", async () => {
    const { result, rerender } = mountSpeech();
    act(() => result.current.start("Pasos", "Talk"));
    await complete(requests[0], "Te cuento.", [{ type: "paragraph", text: "Uno." }]);
    expect(result.current.detail).not.toBeNull();
    rerender({ language: "es", active: false });
    expect(result.current.detail).toBeNull();
    rerender({ language: "es", active: true });
    expect(result.current.detail).toBeNull();
  });
});
