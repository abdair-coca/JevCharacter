// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearGroqKey, saveGroqKey } from "../src/creature/brain/groqKeyStore";
import { LISTEN_SAMPLE_RATE } from "../src/creature/listen/listenProtocol";
import { MicUnavailableError } from "../src/creature/listen/micCapture";
import { useHandsFree } from "../src/creature/listen/useHandsFree";

const mic = vi.hoisted(() => ({
  onAudio: null as ((samples: Float32Array) => void) | null,
  stop: vi.fn(),
  failure: null as Error | null,
}));

vi.mock("../src/creature/listen/micCapture", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/creature/listen/micCapture")>();
  return {
    ...original,
    micSupported: () => true,
    startMicCapture: vi.fn((onAudio: (samples: Float32Array) => void) => {
      if (mic.failure) return Promise.reject(mic.failure);
      mic.onAudio = onAudio;
      return Promise.resolve({ stop: mic.stop });
    }),
  };
});

const TEST_GROQ_KEY = "gsk_test_visible_key_1234567890";
const samplesFor = (ms: number) => Math.round((LISTEN_SAMPLE_RATE * ms) / 1000);
// One spoken phrase as the microphone delivers it: silence, a voice, then silence that closes it.
function say() {
  const audio = new Float32Array(samplesFor(2600));
  for (let index = samplesFor(500); index < samplesFor(1500); index++) audio[index] = 0.3 * Math.sin(index / 6);
  act(() => {
    for (let offset = 0; offset < audio.length; offset += 683) mic.onAudio?.(audio.subarray(offset, offset + 683));
  });
}

function transcripts(...texts: string[]) {
  const bodies: { audio: string; language: string }[] = [];
  const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as { audio: string; language: string });
    return Promise.resolve(new Response(JSON.stringify({ text: texts[bodies.length - 1] ?? "" })));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, bodies };
}

type Props = { enabled: boolean; busy: boolean; speaking: boolean };

function mount(initial: Partial<Props> = {}) {
  const onMessage = vi.fn();
  const onSummoned = vi.fn();
  const rendered = renderHook((props: Props) => useHandsFree({ ...props, language: "es", onMessage, onSummoned }), {
    initialProps: { enabled: true, busy: false, speaking: false, ...initial },
  });
  return { ...rendered, onMessage, onSummoned };
}

async function turnOn(result: { current: ReturnType<typeof useHandsFree> }) {
  act(() => result.current.onToggle());
  await waitFor(() => expect(result.current.status).toBe("listening"));
}

beforeEach(() => {
  mic.onAudio = null;
  mic.failure = null;
  mic.stop.mockClear();
  saveGroqKey(TEST_GROQ_KEY);
});

afterEach(() => {
  cleanup();
  clearGroqKey();
  vi.unstubAllGlobals();
});

describe("useHandsFree", () => {
  it("sends a phrase said to Jev by name, without his name", async () => {
    const { bodies } = transcripts("Jev, ¿qué carreras puedo estudiar?");
    const { result, onMessage } = mount();
    await turnOn(result);

    say();
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith("¿qué carreras puedo estudiar?"));
    expect(bodies[0].language).toBe("es");
    expect(Buffer.from(bodies[0].audio, "base64").toString("ascii", 0, 4)).toBe("RIFF");
    expect(result.current.heard).toBe("¿qué carreras puedo estudiar?");
  });

  it("ignores a phrase that does not name him", async () => {
    const { fetchMock } = transcripts("y luego fuimos al cine");
    const { result, onMessage } = mount();
    await turnOn(result);

    say();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.status).toBe("listening"));
    expect(onMessage).not.toHaveBeenCalled();
    expect(result.current.heard).toBe("");
  });

  it("drops what it hears while Jev decides or talks, before transcribing it", async () => {
    const { fetchMock } = transcripts("Jev, hola");
    const { result, rerender } = mount();
    await turnOn(result);

    rerender({ enabled: true, busy: true, speaking: true });
    say();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts an answer without his name right after he finishes talking", async () => {
    transcripts("me gusta dibujar");
    const { result, rerender, onMessage } = mount({ busy: true, speaking: true });
    await turnOn(result);

    rerender({ enabled: true, busy: false, speaking: false });
    say();
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith("me gusta dibujar"));
  });

  it("only his name makes him look up, and the next phrase needs no name", async () => {
    transcripts("Oye, Jev", "¿qué hora es?");
    const { result, onMessage, onSummoned } = mount();
    await turnOn(result);

    say();
    await waitFor(() => expect(onSummoned).toHaveBeenCalledTimes(1));
    expect(onMessage).not.toHaveBeenCalled();
    say();
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith("¿qué hora es?"));
  });

  it("switches off and points at the key when Groq rejects it", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 401 }))));
    const { result } = mount();
    await turnOn(result);

    say();
    await waitFor(() => expect(result.current.notice).toBe("keyRejected"));
    expect(result.current.status).toBe("off");
    expect(mic.stop).toHaveBeenCalled();

    act(() => { saveGroqKey(TEST_GROQ_KEY); });
    expect(result.current.notice).toBeNull();
  });

  it("switches off as soon as the key is removed, without another phrase", async () => {
    const { fetchMock } = transcripts();
    const { result } = mount();
    await turnOn(result);

    act(() => clearGroqKey());
    expect(result.current.status).toBe("off");
    expect(result.current.notice).toBe("needsKey");
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => { saveGroqKey(TEST_GROQ_KEY); });
    expect(result.current.notice).toBeNull();
  });

  it("forgets what it heard when switched off", async () => {
    transcripts("Jev, ¿qué hora es?");
    const { result } = mount();
    await turnOn(result);
    say();
    await waitFor(() => expect(result.current.heard).toBe("¿qué hora es?"));

    act(() => result.current.onToggle());
    expect(result.current.heard).toBe("");
  });

  it("keeps listening and says so when Groq runs out of quota", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 429 }))));
    const { result } = mount();
    await turnOn(result);

    say();
    await waitFor(() => expect(result.current.notice).toBe("quota"));
    expect(result.current.status).toBe("listening");
  });

  it("never opens the microphone without a Groq key", () => {
    clearGroqKey();
    const { result } = mount();
    act(() => result.current.onToggle());
    expect(result.current.status).toBe("off");
    expect(result.current.notice).toBe("needsKey");
    expect(mic.onAudio).toBeNull();
  });

  it("reports a denied permission", async () => {
    mic.failure = new MicUnavailableError("denied");
    const { result } = mount();
    act(() => result.current.onToggle());
    await waitFor(() => expect(result.current.notice).toBe("denied"));
    expect(result.current.status).toBe("off");
  });

  it("switches off when Home stops being conversational, and on a second toggle", async () => {
    const { result, rerender } = mount();
    await turnOn(result);
    rerender({ enabled: false, busy: false, speaking: false });
    expect(result.current.status).toBe("off");
    expect(mic.stop).toHaveBeenCalledTimes(1);

    rerender({ enabled: true, busy: false, speaking: false });
    await turnOn(result);
    act(() => result.current.onToggle());
    expect(result.current.status).toBe("off");
    expect(mic.stop).toHaveBeenCalledTimes(2);
  });
});
