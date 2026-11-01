// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVoiceEngine } from "../src/creature/voice/voiceEngine";
import { ACTION_MOTIFS, scoreSpeech, type VoiceGlide } from "../src/creature/voice/voiceScore";
import { FakeContext, fakeCore, reaches, silenced, type FakeNode } from "./audioFakes";

let context: FakeContext;
let clock: number;
// Each glide is a tone plus its sweet octave; a late vibrato adds one LFO.
const sources = (glides: readonly VoiceGlide[]) => glides.length * 2 + glides.filter(glide => glide.vibrato).length;
function setup() {
  const core = fakeCore(context);
  return { core, voice: createVoiceEngine({ core, now: () => clock }) };
}

beforeEach(() => {
  context = new FakeContext();
  clock = 10_000;
});

describe("Jev voice reply end", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("reports a complete reply only after its last syllable has sounded", () => {
    vi.useFakeTimers();
    const { core, voice } = setup();
    core.unlock();
    const onEnd = vi.fn();
    voice.speak("reply", "Hola, ¿cómo estás?", true, onEnd);
    expect(onEnd).not.toHaveBeenCalled();
    const stops = context.oscillators.flatMap(oscillator => oscillator.stops).filter((time): time is number => typeof time === "number");
    vi.advanceTimersByTime((Math.max(...stops) + 1) * 1000);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("reports a complete reply at once when there is no sound to wait for", () => {
    const { voice } = setup();
    const onEnd = vi.fn();
    voice.speak("reply", "Listo.", true, onEnd);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("cancels the pending end when speech stops, and reports it when muting", () => {
    vi.useFakeTimers();
    const { core, voice } = setup();
    core.unlock();
    const cancelled = vi.fn();
    voice.speak("reply", "Hola.", true, cancelled);
    voice.stopSpeech();
    vi.advanceTimersByTime(60_000);
    expect(cancelled).not.toHaveBeenCalled();
    const muted = vi.fn();
    voice.speak("next", "Hola.", true, muted);
    voice.stop();
    expect(muted).toHaveBeenCalledOnce();
  });
});

describe("another voice speaking for Jev", () => {
  afterEach(() => { vi.useRealTimers(); });
  const signature = () => context.oscillators.filter(oscillator => oscillator.type === "triangle");
  const signatureEnd = () => Math.max(...context.oscillators.flatMap(oscillator => oscillator.stops).filter((time): time is number => typeof time === "number")) - 0.2;

  it("signs the reply with a chirp, queues the audio after it and reports the end once it has sounded", () => {
    vi.useFakeTimers();
    const { core, voice } = setup();
    core.unlock();
    const onEnd = vi.fn();
    const handle = voice.beginSpeech("reply", onEnd);
    expect(signature().length).toBeGreaterThan(0);
    const chirpEnd = signatureEnd();

    handle.play(new Float32Array(50), 100);
    handle.play(new Float32Array(100), 100);
    const [first, second] = context.noises;
    expect(first.startAt).toBeCloseTo(chirpEnd, 5);
    expect(second.startAt).toBeCloseTo(chirpEnd + 0.5, 5);
    expect(reaches(first, core.bus("voice") as unknown as FakeNode)).toBe(true);

    handle.finish();
    vi.advanceTimersByTime((chirpEnd + 1.4) * 1000);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("is cut like the chirps: stopping silences the queued audio and reports no end", () => {
    vi.useFakeTimers();
    const { core, voice } = setup();
    core.unlock();
    const onEnd = vi.fn();
    const handle = voice.beginSpeech("reply", onEnd);
    handle.play(new Float32Array(100), 100);
    voice.stopSpeech();
    expect(silenced(context.noises[0])).toBe(true);
    expect(handle.active).toBe(false);
    handle.play(new Float32Array(100), 100);
    handle.finish();
    expect(context.noises).toHaveLength(1);
    vi.runAllTimers();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("a new reply replaces it", () => {
    const { core, voice } = setup();
    core.unlock();
    const first = voice.beginSpeech("first");
    first.play(new Float32Array(100), 100);
    voice.speak("second", "Hola.", true);
    expect(first.active).toBe(false);
    expect(silenced(context.noises[0])).toBe(true);
  });

  it("muting mid-reply still reports its end", () => {
    const { core, voice } = setup();
    core.unlock();
    const onEnd = vi.fn();
    voice.beginSpeech("reply", onEnd).play(new Float32Array(100), 100);
    core.setEnabled(false);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("falls back on chirping the sentence right after the signature", () => {
    const { core, voice } = setup();
    core.unlock();
    const onEnd = vi.fn();
    const handle = voice.beginSpeech("reply", onEnd);
    const chirps = signature().length;
    const chirpEnd = signatureEnd();
    handle.fallback("Hola, ¿cómo estás?");
    const sentence = signature().slice(chirps);
    expect(sentence).toHaveLength(scoreSpeech("Hola, ¿cómo estás?").length);
    expect(Math.min(...sentence.map(oscillator => oscillator.startAt))).toBeGreaterThanOrEqual(chirpEnd - 1e-6);
  });

  it("without sound there is nothing to queue and the end comes at once", () => {
    const { voice } = setup();
    const onEnd = vi.fn();
    const handle = voice.beginSpeech("reply", onEnd);
    handle.play(new Float32Array(100), 100);
    expect(context.noises).toHaveLength(0);
    handle.finish();
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

describe("Jev voice engine", () => {
  it("stays silent until a user gesture unlocks audio", () => {
    const { core, voice } = setup();
    voice.cue("Hello");
    expect(context.oscillators).toHaveLength(0);
    core.unlock();
    voice.cue("Hello");
    expect(context.oscillators).toHaveLength(sources(ACTION_MOTIFS.Hello));
    expect(context.oscillators.every(oscillator => oscillator.startAt >= context.currentTime)).toBe(true);
  });

  it("glides between syllables instead of jumping, scooping fast into each one", () => {
    const { core, voice } = setup();
    core.unlock();
    voice.speak("reply", "palabra", true);
    const [tone] = context.oscillators;
    expect(tone.type).toBe("triangle");
    const targets = tone.frequency.events.filter(event => event.method === "target");
    expect(targets.length).toBeGreaterThanOrEqual(2);
    expect(tone.frequency.events.filter(event => event.method === "set")).toHaveLength(1);
    // Scoops are approached faster than the glides between notes.
    expect(new Set(targets.map(event => event.constant)).size).toBe(2);
  });

  it("sounds dry: speech never reaches the hall", () => {
    const { core, voice } = setup();
    core.unlock();
    voice.speak("reply", "¡Hola!", true);
    const [hall] = context.convolvers;
    expect(context.oscillators.length).toBeGreaterThan(0);
    for (const oscillator of context.oscillators) expect(reaches(oscillator, hall)).toBe(false);
  });

  it("does not sound the return to Base", () => {
    const { core, voice } = setup();
    core.unlock();
    voice.cue("Base");
    expect(context.oscillators).toHaveLength(0);
  });

  it("muting stops scheduled sound and blocks new cues", () => {
    const { core, voice } = setup();
    core.unlock();
    voice.cue("Flower");
    const playing = [...context.oscillators];
    core.setEnabled(false);
    expect(playing.every(silenced)).toBe(true);
    voice.cue("Hello");
    core.unlock();
    expect(context.oscillators).toHaveLength(playing.length);
  });

  it("hiding the tab silences and suspends audio, then resumes it", () => {
    const { core, voice } = setup();
    core.unlock();
    voice.cue("Ghost");
    const playing = [...context.oscillators];
    core.setHidden(true);
    expect(playing.every(silenced)).toBe(true);
    expect(context.suspend).toHaveBeenCalledOnce();
    voice.cue("Hello");
    expect(context.oscillators).toHaveLength(playing.length);
    core.setHidden(false);
    expect(context.resume).toHaveBeenCalledOnce();
  });

  it("voices streamed text once, whole words first and the rest when complete", () => {
    const { core, voice } = setup();
    core.unlock();
    voice.speak("reply", "Hola, có", false);
    expect(context.oscillators).toHaveLength(2);
    const firstStart = Math.max(...context.oscillators.map(oscillator => oscillator.startAt));
    voice.speak("reply", "Hola, cómo", false);
    expect(context.oscillators).toHaveLength(2);
    voice.speak("reply", "Hola, cómo estás?", true);
    const added = context.oscillators.slice(2);
    expect(added).toHaveLength(sources(scoreSpeech("Hola, cómo estás?").slice(1)));
    expect(Math.min(...added.map(oscillator => oscillator.startAt))).toBeGreaterThan(firstStart);
  });

  it("a new phrase replaces the previous one", () => {
    const { core, voice } = setup();
    core.unlock();
    voice.speak("first", "Una frase larga para hablar.", true);
    const first = [...context.oscillators];
    voice.speak("second", "Otra.", true);
    expect(first.every(silenced)).toBe(true);
    expect(context.oscillators.length).toBeGreaterThan(first.length);
  });

  it("a new action stops speech, but a tap while talking does not", () => {
    const { core, voice } = setup();
    core.unlock();
    voice.speak("reply", "Una frase para hablar.", true);
    const speech = [...context.oscillators];
    voice.cue("bump");
    expect(speech.some(silenced)).toBe(false);
    voice.cue("question");
    expect(speech.every(silenced)).toBe(true);
  });

  it("babbles for a talk gesture without text, but waits for real text when it arrives", () => {
    vi.useFakeTimers();
    const { core, voice } = setup();
    core.unlock();
    voice.cue("Talk");
    expect(context.oscillators).toHaveLength(0);
    vi.advanceTimersByTime(450);
    expect(context.oscillators.length).toBeGreaterThan(0);

    context.oscillators = [];
    voice.stop();
    clock += 5000;
    voice.cue("talkb");
    voice.speak("real", "Hola.", true);
    vi.advanceTimersByTime(1000);
    expect(context.oscillators).toHaveLength(sources(scoreSpeech("Hola.")));
  });

  it("stop cancels a pending talk babble and every channel", () => {
    vi.useFakeTimers();
    const { core, voice } = setup();
    core.unlock();
    voice.cue("Hello");
    voice.cue("Talk");
    const playing = [...context.oscillators];
    voice.stop();
    vi.advanceTimersByTime(1000);
    expect(playing.every(silenced)).toBe(true);
    expect(context.oscillators).toHaveLength(playing.length);
  });

  it("keeps working without Web Audio support", () => {
    const core = fakeCore(null);
    const voice = createVoiceEngine({ core });
    core.unlock();
    expect(core.unlocked()).toBe(false);
    expect(() => { voice.cue("Hello"); voice.speak("x", "Hola.", true); voice.stop(); }).not.toThrow();
  });
});
