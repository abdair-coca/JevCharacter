// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GEMINI_KEY_HEADER, SPEECH_AUDIO_SAMPLE_RATE } from "../src/creature/brain/speechProtocol";
import { createGeminiVoice, createPcmDecoder, streamVoice, VoiceRequestError, voiceProblem } from "../src/creature/voice/geminiVoice";
import type { SpeechHandle } from "../src/creature/voice/voiceEngine";

const KEY = "AIza_test_visible_key_1234567890";

function pcm(...values: number[]) {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setInt16(index * 2, value, true));
  return bytes;
}

function streamed(...chunks: Uint8Array[]) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }));
}

/** An engine that records what each voice did; its handle stays active until cut. */
function fakeEngine() {
  const handle = { active: true, play: vi.fn(), finish: vi.fn(), fallback: vi.fn() };
  const engine = {
    speak: vi.fn(),
    stopSpeech: vi.fn(() => { handle.active = false; }),
    beginSpeech: vi.fn((): SpeechHandle => handle),
  };
  return { engine, handle };
}

/** A stream the test drives: it hands out audio and settles when told. */
function controlledStream() {
  const control = { onAudio: (_samples: Float32Array) => {}, resolve: () => {}, reject: (_error: unknown) => {}, signal: null as AbortSignal | null };
  const stream = vi.fn((options: Parameters<typeof streamVoice>[0]) => new Promise<void>((resolve, reject) => {
    control.onAudio = options.onAudio;
    control.signal = options.signal;
    control.resolve = resolve;
    control.reject = reject;
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  return { stream, control };
}

function voiceWith(stream: typeof streamVoice, key: string | null = KEY, audible = true) {
  const { engine, handle } = fakeEngine();
  const voice = createGeminiVoice({ engine, core: { audible: () => audible }, readKey: () => key, stream });
  return { voice, engine, handle };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => voiceProblem.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createPcmDecoder", () => {
  it("turns 16-bit little-endian PCM into samples, carrying a byte split across chunks", () => {
    const decode = createPcmDecoder();
    const bytes = pcm(0, 16384, -32768, 32767);
    expect(Array.from(decode(bytes.subarray(0, 3)))).toEqual([0]);
    expect(Array.from(decode(bytes.subarray(3)))).toEqual([0.5, -1, 32767 / 32768]);
  });
});

describe("streamVoice", () => {
  it("asks /api/speak with the key as a header and hands out the audio as it arrives", async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(streamed(pcm(16384), pcm(-16384, 0))));
    vi.stubGlobal("fetch", fetchMock);
    const onAudio = vi.fn();
    await streamVoice({ text: "¡Hola!", language: "es", apiKey: KEY, signal: new AbortController().signal, onAudio });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/speak");
    expect(init?.headers).toEqual({ "Content-Type": "application/json", [GEMINI_KEY_HEADER]: KEY });
    expect(JSON.parse(String(init?.body))).toEqual({ text: "¡Hola!", language: "es" });
    expect(onAudio.mock.calls.map(([samples]) => Array.from(samples as Float32Array))).toEqual([[0.5], [-0.5, 0]]);
  });

  it("reports the status of a refused request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 429 }))));
    await expect(streamVoice({ text: "Hola.", language: "es", apiKey: KEY, signal: new AbortController().signal, onAudio: vi.fn() }))
      .rejects.toMatchObject({ name: "VoiceRequestError", status: 429 });
  });
});

describe("Jev's Gemini voice", () => {
  it("lets Gemini say a finished sentence after the signature, then reports the end", async () => {
    const { stream, control } = controlledStream();
    const { voice, engine, handle } = voiceWith(stream);
    const onEnd = vi.fn();
    voice.speak("home-1", "¡Hola, amigo!", true, onEnd, "en");

    expect(engine.beginSpeech).toHaveBeenCalledWith("home-1", onEnd);
    expect(stream.mock.calls[0][0]).toMatchObject({ text: "¡Hola, amigo!", language: "en", apiKey: KEY });
    const samples = new Float32Array([0.1, 0.2]);
    control.onAudio(samples);
    expect(handle.play).toHaveBeenCalledWith(samples, SPEECH_AUDIO_SAMPLE_RATE);
    control.resolve();
    await flush();
    expect(handle.finish).toHaveBeenCalledOnce();
    expect(handle.fallback).not.toHaveBeenCalled();
    expect(engine.speak).not.toHaveBeenCalled();
  });

  it.each([
    ["without a Google key", null, true, true],
    ["while muted", KEY, false, true],
    ["for streamed, unfinished text", KEY, true, false],
  ])("chirps %s", (_case, key, audible, complete) => {
    const { stream } = controlledStream();
    const { voice, engine } = voiceWith(stream, key, audible);
    const onEnd = vi.fn();
    voice.speak("home-1", "Hola.", complete, onEnd);
    expect(engine.speak).toHaveBeenCalledWith("home-1", "Hola.", complete, onEnd);
    expect(stream).not.toHaveBeenCalled();
  });

  it.each([
    [401, "rejected"],
    [429, "quota"],
    [502, null],
  ])("chirps the sentence when Gemini answers %i, and Ajustes learns %s", async (status, problem) => {
    const { stream, control } = controlledStream();
    const { voice, handle } = voiceWith(stream);
    voice.speak("home-1", "Hola.", true);
    control.reject(new VoiceRequestError(status));
    await flush();
    expect(handle.fallback).toHaveBeenCalledWith("Hola.");
    expect(voiceProblem.read()).toBe(problem);
  });

  it("a working voice clears the problem Ajustes showed", async () => {
    const { stream, control } = controlledStream();
    const { voice } = voiceWith(stream);
    voice.speak("home-1", "Hola.", true);
    control.reject(new VoiceRequestError(429));
    await flush();
    voice.speak("home-2", "Hola otra vez.", true);
    control.onAudio(new Float32Array([0.1]));
    control.resolve();
    await flush();
    expect(voiceProblem.read()).toBeNull();
  });

  it("chirps when the first audio is too slow, and ignores what arrives later", async () => {
    vi.useFakeTimers();
    const { stream, control } = controlledStream();
    const { voice, handle } = voiceWith(stream);
    voice.speak("home-1", "Hola.", true);
    vi.advanceTimersByTime(2_999);
    expect(handle.fallback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(handle.fallback).toHaveBeenCalledOnce();
    expect(control.signal?.aborted).toBe(true);
    await vi.runAllTimersAsync();
    expect(handle.finish).not.toHaveBeenCalled();
    expect(handle.fallback).toHaveBeenCalledOnce();
  });

  it("plays what arrived when the stream breaks mid-sentence", async () => {
    const { stream, control } = controlledStream();
    const { voice, handle } = voiceWith(stream);
    voice.speak("home-1", "Hola.", true);
    control.onAudio(new Float32Array([0.1]));
    control.reject(new TypeError("network"));
    await flush();
    expect(handle.finish).toHaveBeenCalledOnce();
    expect(handle.fallback).not.toHaveBeenCalled();
  });

  it("stops the request when the reply is cut, and a new sentence replaces the old one", async () => {
    const { stream, control } = controlledStream();
    const { voice, engine, handle } = voiceWith(stream);
    voice.speak("home-1", "Hola.", true);
    const first = control.signal;
    voice.stopSpeech();
    expect(first?.aborted).toBe(true);
    expect(engine.stopSpeech).toHaveBeenCalledOnce();
    await flush();
    expect(handle.finish).not.toHaveBeenCalled();
    expect(handle.fallback).not.toHaveBeenCalled();

    voice.speak("home-2", "Otra.", true);
    const second = control.signal;
    voice.speak("home-3", "Y otra.", true);
    expect(second?.aborted).toBe(true);
  });

  it("drops audio for a reply that was cut elsewhere", () => {
    const { stream, control } = controlledStream();
    const { voice, handle } = voiceWith(stream);
    voice.speak("home-1", "Hola.", true);
    handle.active = false;
    control.onAudio(new Float32Array([0.1]));
    expect(handle.play).not.toHaveBeenCalled();
    expect(control.signal?.aborted).toBe(true);
  });
});
