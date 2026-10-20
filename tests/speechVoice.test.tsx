// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpeechCaption } from "../src/hooks/useSpeechSession";
import { useSpeechVoice } from "../src/creature/voice/useSpeechVoice";

afterEach(cleanup);
const caption = (text: string, complete: boolean, generation = 1): SpeechCaption => ({ text, complete, generation, language: "es" });

function mount() {
  const voice = { speak: vi.fn(), stopSpeech: vi.fn() };
  const onFinished = vi.fn();
  const initialProps: { value: SpeechCaption | null; silenced: boolean } = { value: null, silenced: false };
  const hook = renderHook(({ value, silenced }) => useSpeechVoice(value, silenced, voice, onFinished), { initialProps });
  return { ...hook, voice, onFinished };
}

describe("Home reply voice", () => {
  it("follows each streamed caption of a reply under the same phrase key", () => {
    const { rerender, voice } = mount();
    rerender({ value: caption("Hola", false), silenced: false });
    rerender({ value: caption("Hola, ¿cómo estás?", true), silenced: false });
    expect(voice.speak.mock.calls.map(call => call.slice(0, 3))).toEqual([["home-1", "Hola", false], ["home-1", "Hola, ¿cómo estás?", true]]);
  });

  it("stops an unfinished reply when it is cancelled, but lets a finished one fade naturally", () => {
    const { rerender, voice } = mount();
    rerender({ value: caption("Hola", false), silenced: false });
    rerender({ value: null, silenced: false });
    expect(voice.stopSpeech).toHaveBeenCalledOnce();
    rerender({ value: caption("Listo.", true, 2), silenced: false });
    rerender({ value: null, silenced: false });
    expect(voice.stopSpeech).toHaveBeenCalledOnce();
  });

  it("stays quiet while a speech notice replaces the caption", () => {
    const { rerender, voice } = mount();
    rerender({ value: caption("Hola", false), silenced: true });
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it("reports the end of a complete reply through the voice, not when the text stops", () => {
    const { rerender, voice, onFinished } = mount();
    rerender({ value: caption("Hola", false), silenced: false });
    rerender({ value: caption("Hola, ¿cómo estás?", true), silenced: false });
    expect(onFinished).not.toHaveBeenCalled();
    const reportEnd = voice.speak.mock.calls.at(-1)?.[3] as () => void;
    reportEnd();
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it("reports the end at once when a complete reply is silenced", () => {
    const { rerender, onFinished } = mount();
    rerender({ value: caption("Listo.", true), silenced: true });
    expect(onFinished).toHaveBeenCalledOnce();
  });
});
