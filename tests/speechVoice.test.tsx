// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpeechCaption } from "../src/hooks/useSpeechSession";
import { useSpeechVoice } from "../src/creature/voice/useSpeechVoice";

afterEach(cleanup);
const caption = (text: string, complete: boolean, generation = 1): SpeechCaption => ({ text, complete, generation, language: "es" });

function mount() {
  const voice = { speak: vi.fn(), stopSpeech: vi.fn() };
  const initialProps: { value: SpeechCaption | null; silenced: boolean } = { value: null, silenced: false };
  const hook = renderHook(({ value, silenced }) => useSpeechVoice(value, silenced, voice), { initialProps });
  return { ...hook, voice };
}

describe("Home reply voice", () => {
  it("follows each streamed caption of a reply under the same phrase key", () => {
    const { rerender, voice } = mount();
    rerender({ value: caption("Hola", false), silenced: false });
    rerender({ value: caption("Hola, ¿cómo estás?", true), silenced: false });
    expect(voice.speak.mock.calls).toEqual([["home-1", "Hola", false], ["home-1", "Hola, ¿cómo estás?", true]]);
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
});
