// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVoiceEngine } from "../src/creature/voice/voiceEngine";
import { ACTION_MOTIFS, scoreSpeech, type VoiceGlide } from "../src/creature/voice/voiceScore";
import { FakeContext, fakeCore, reaches, silenced } from "./audioFakes";

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
