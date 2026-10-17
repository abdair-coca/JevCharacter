// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVoiceEngine } from "../src/creature/voice/voiceEngine";
import { ACTION_MOTIFS, scoreSpeech } from "../src/creature/voice/voiceScore";

class FakeParam {
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
}
class FakeNode {
  disconnected = false;
  connect<T>(target: T) { return target; }
  disconnect() { this.disconnected = true; }
}
class FakeOscillator extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  startAt = -1;
  stops: (number | undefined)[] = [];
  onended: (() => void) | null = null;
  start(time: number) { this.startAt = time; }
  stop(time?: number) { this.stops.push(time); }
  addEventListener() {}
}
class FakeContext {
  currentTime = 0;
  state: "running" | "suspended" | "closed" = "running";
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  resume = vi.fn(async () => { this.state = "running"; });
  suspend = vi.fn(async () => { this.state = "suspended"; });
  createOscillator() { const oscillator = new FakeOscillator(); this.oscillators.push(oscillator); return oscillator; }
  createGain() { return Object.assign(new FakeNode(), { gain: new FakeParam() }); }
  createDynamicsCompressor() { return new FakeNode(); }
}

let context: FakeContext;
let clock: number;
const engine = () => createVoiceEngine({ createContext: () => context as unknown as AudioContext, now: () => clock });
const sources = (notes: readonly { vibrato?: unknown }[]) => notes.length + notes.filter(note => note.vibrato).length;
const silenced = (oscillator: FakeOscillator) => oscillator.stops.includes(undefined) && oscillator.disconnected;

beforeEach(() => {
  context = new FakeContext();
  clock = 10_000;
});

describe("Jev voice engine", () => {
  it("stays silent until a user gesture unlocks audio", () => {
    const voice = engine();
    voice.cue("Hello");
    expect(context.oscillators).toHaveLength(0);
    voice.unlock();
    voice.cue("Hello");
    expect(context.oscillators).toHaveLength(sources(ACTION_MOTIFS.Hello));
    expect(context.oscillators.every(oscillator => oscillator.startAt >= context.currentTime)).toBe(true);
  });

  it("does not sound the return to Base", () => {
    const voice = engine();
    voice.unlock();
    voice.cue("Base");
    expect(context.oscillators).toHaveLength(0);
  });

  it("muting stops scheduled sound and blocks new cues", () => {
    const voice = engine();
    voice.unlock();
    voice.cue("Flower");
    const playing = [...context.oscillators];
    voice.setEnabled(false);
    expect(playing.every(silenced)).toBe(true);
    voice.cue("Hello");
    voice.unlock();
    expect(context.oscillators).toHaveLength(playing.length);
  });

  it("hiding the tab silences and suspends audio, then resumes it", () => {
    const voice = engine();
    voice.unlock();
    voice.cue("Ghost");
    const playing = [...context.oscillators];
    voice.setHidden(true);
    expect(playing.every(silenced)).toBe(true);
    expect(context.suspend).toHaveBeenCalledOnce();
    context.state = "suspended";
    voice.cue("Hello");
    expect(context.oscillators).toHaveLength(playing.length);
    voice.setHidden(false);
    expect(context.resume).toHaveBeenCalledOnce();
  });

  it("voices streamed text once, whole words first and the rest when complete", () => {
    const voice = engine();
    voice.unlock();
    voice.speak("reply", "Hola, có", false);
    expect(context.oscillators).toHaveLength(2);
    const firstEnd = Math.max(...context.oscillators.map(oscillator => oscillator.startAt));
    voice.speak("reply", "Hola, cómo", false);
    expect(context.oscillators).toHaveLength(2);
    voice.speak("reply", "Hola, cómo estás?", true);
    const added = context.oscillators.slice(2);
    expect(added).toHaveLength(sources(scoreSpeech("Hola, cómo estás?").slice(2)));
    expect(Math.min(...added.map(oscillator => oscillator.startAt))).toBeGreaterThan(firstEnd);
  });

  it("a new phrase replaces the previous one", () => {
    const voice = engine();
    voice.unlock();
    voice.speak("first", "Una frase larga para hablar.", true);
    const first = [...context.oscillators];
    voice.speak("second", "Otra.", true);
    expect(first.every(silenced)).toBe(true);
    expect(context.oscillators.length).toBeGreaterThan(first.length);
  });

  it("a new action stops speech, but a tap while talking does not", () => {
    const voice = engine();
    voice.unlock();
    voice.speak("reply", "Una frase para hablar.", true);
    const speech = [...context.oscillators];
    voice.cue("bump");
    expect(speech.some(silenced)).toBe(false);
    voice.cue("question");
    expect(speech.every(silenced)).toBe(true);
  });

  it("babbles for a talk gesture without text, but waits for real text when it arrives", () => {
    vi.useFakeTimers();
    const voice = engine();
    voice.unlock();
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
    const voice = engine();
    voice.unlock();
    voice.cue("Hello");
    voice.cue("Talk");
    const playing = [...context.oscillators];
    voice.stop();
    vi.advanceTimersByTime(1000);
    expect(playing.every(silenced)).toBe(true);
    expect(context.oscillators).toHaveLength(playing.length);
  });

  it("keeps working without Web Audio support", () => {
    const voice = createVoiceEngine({ createContext: () => null });
    voice.unlock();
    expect(voice.unlocked()).toBe(false);
    expect(() => { voice.cue("Hello"); voice.speak("x", "Hola.", true); voice.stop(); }).not.toThrow();
  });
});
