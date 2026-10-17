// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStoryMusic, REVEAL_CHORD, SCENE_CHORDS, STEP_SECONDS, storyCues } from "../src/features/story/storyMusic";
import { FakeContext, fakeCore, scheduledToStop, type FakeGain, type FakeOscillator } from "./audioFakes";

let context: FakeContext;
const hz = (note: number) => Math.round(440 * 2 ** ((note - 69) / 12));
const pitches = (oscillators: FakeOscillator[]) => new Set(oscillators.map(oscillator => Math.round(oscillator.frequency.events[0]?.value ?? 0)));
const first = (oscillator: FakeOscillator) => oscillator.frequency.events[0]?.value;
// Strings are pairs of saws detuned by ±7 cents; the horn uses ±6.
const strings = (from = 0) => context.oscillators.slice(from).filter(oscillator => Math.abs(oscillator.detune.events[0]?.value ?? 0) === 7);
const horns = (from = 0) => context.oscillators.slice(from).filter(oscillator => Math.abs(oscillator.detune.events[0]?.value ?? 0) === 6);
const booms = (from = 0) => context.oscillators.slice(from).filter(oscillator => first(oscillator) === 95);
const kicks = (from = 0) => context.oscillators.slice(from).filter(oscillator => first(oscillator) === 150);
const peak = (oscillator: FakeOscillator) => (oscillator.outputs[0] as FakeGain).gain.events[1].value;
/** The riser's level: looping noise → band-pass → level. */
const riserLevel = () => {
  const level = context.noises.find(noise => noise.loop)!.outputs[0].outputs[0] as FakeGain;
  return level.gain.events.at(-1)!.value;
};

/** Moves the audio clock and the scheduler timer together. */
function advance(seconds: number) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.025) {
    context.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}

function setup() {
  const core = fakeCore(context);
  return { core, music: createStoryMusic(core) };
}

beforeEach(() => {
  vi.useFakeTimers();
  context = new FakeContext();
});
afterEach(() => { vi.useRealTimers(); });

describe("story soundtrack", () => {
  it("waits for the first gesture, then fades in the current scene without an impact", () => {
    const { core, music } = setup();
    music.setScene(3);
    music.start();
    expect(context.oscillators).toHaveLength(0);
    core.unlock();
    advance(0.5);
    expect(music.playing()).toBe(true);
    for (const note of SCENE_CHORDS[3].notes) expect(pitches(strings()).has(hz(note))).toBe(true);
    expect(booms()).toHaveLength(0);
  });

  it("arriving at a scene lands an impact on the next sixteenth, with the new chord", () => {
    const { core, music } = setup();
    core.unlock();
    music.start();
    advance(1);
    const before = context.oscillators.length;
    const oldStrings = strings();
    music.setScene(1);
    expect(strings(before)).toHaveLength(0);
    advance(STEP_SECONDS + 0.1);
    const [boom] = booms(before);
    const arrived = strings(before);
    expect(boom).toBeDefined();
    for (const note of SCENE_CHORDS[1].notes) expect(pitches(arrived).has(hz(note))).toBe(true);
    expect(arrived[0].startAt).toBeCloseTo(boom.startAt);
    expect(oldStrings.every(scheduledToStop)).toBe(true);
  });

  it("merges impacts during a fast jump and lands a softer one going back", () => {
    const { core, music } = setup();
    core.unlock();
    music.start();
    advance(1);
    music.setScene(2);
    advance(0.3);
    const before = context.oscillators.length;
    music.setScene(3);
    music.setScene(4);
    advance(0.3);
    expect(booms(before)).toHaveLength(0);
    for (const note of SCENE_CHORDS[4].notes) expect(pitches(strings(before)).has(hz(note))).toBe(true);
    advance(1);
    music.setScene(3);
    advance(0.3);
    const [forward] = booms();
    const [back] = booms(before);
    expect(peak(back)).toBeLessThan(peak(forward) * 0.6);
  });

  it("never swallows the climax, even right after the last scene's own impact", () => {
    const { core, music } = setup();
    core.unlock();
    music.start();
    advance(1);
    music.setScene(4);
    advance(0.3);
    expect(booms()).toHaveLength(1);
    music.setBloom(1);
    advance(0.3);
    expect(booms()).toHaveLength(2);
    expect(peak(booms()[1])).toBeGreaterThan(peak(booms()[0]));
  });

  it("builds a riser toward the next scene and silences it on arrival", () => {
    const { core, music } = setup();
    core.unlock();
    music.start();
    advance(1);
    expect(riserLevel()).toBeLessThan(0.001);
    music.setRise(0.8);
    expect(riserLevel()).toBeGreaterThan(0.05);
    music.setScene(1);
    advance(0.3);
    expect(riserLevel()).toBeLessThan(0.001);
    // The scroll still reads the old transition for a moment; it stays quiet.
    music.setRise(0.95);
    expect(riserLevel()).toBeLessThan(0.001);
    music.setRise(0.05);
    music.setRise(0.6);
    expect(riserLevel()).toBeGreaterThan(0.04);
  });

  it("grows scene by scene: drums and the hero theme join as the story advances", () => {
    const { core, music } = setup();
    core.unlock();
    music.start();
    const bar = STEP_SECONDS * 16;
    advance(bar);
    expect(kicks()).toHaveLength(0);
    expect(horns()).toHaveLength(0);
    music.setScene(3);
    advance(0.3);
    const before = context.oscillators.length;
    advance(bar);
    expect(kicks(before).length).toBeGreaterThanOrEqual(3);
    expect(horns(before).length).toBeGreaterThan(0);
  });

  it("blooms with bells as the star forms and resolves into the climax at the reveal", () => {
    const { core, music } = setup();
    core.unlock();
    music.start();
    music.setScene(4);
    advance(1.2);
    const quiet = context.oscillators.length;
    music.setBloom(0.4);
    advance(1);
    expect(context.oscillators.slice(quiet).some(oscillator => (first(oscillator) ?? 0) > 1500)).toBe(true);
    const before = context.oscillators.length;
    music.setBloom(1);
    advance(0.3);
    const [climax] = booms(before);
    expect(climax).toBeDefined();
    expect(peak(climax)).toBeGreaterThan(peak(booms()[0]));
    for (const note of REVEAL_CHORD.notes) expect(pitches(strings(before)).has(hz(note))).toBe(true);
    expect(horns(before).length).toBeGreaterThan(0);
  });

  it("fades out when the story leaves, stops on mute and returns on unmute", () => {
    const { core, music } = setup();
    core.unlock();
    music.start();
    advance(0.5);
    core.setEnabled(false);
    expect(music.playing()).toBe(false);
    expect(context.oscillators.every(scheduledToStop)).toBe(true);
    expect(context.noises.every(scheduledToStop)).toBe(true);
    const silent = context.oscillators.length;
    advance(1);
    expect(context.oscillators).toHaveLength(silent);
    core.setEnabled(true);
    expect(music.playing()).toBe(true);
    music.stop();
    expect(music.playing()).toBe(false);
    expect(context.oscillators.every(scheduledToStop)).toBe(true);
    core.setHidden(true);
    core.setHidden(false);
    expect(music.playing()).toBe(false);
  });

  it("reads the scroll: risers in each transition and toward the reveal, bloom with the star", () => {
    expect(storyCues(0)).toEqual({ bloom: 0, rise: 0 });
    expect(storyCues(0.5).rise).toBe(0);
    expect(storyCues(0.95).rise).toBeGreaterThan(0.8);
    expect(storyCues(1.02).rise).toBeLessThan(0.05);
    expect(storyCues(3.8).rise).toBeGreaterThan(0.3);
    expect(storyCues(3.8).bloom).toBeGreaterThan(0);
    expect(storyCues(4.02).rise).toBe(0);
    expect(storyCues(4.42).bloom).toBeCloseTo(0.5, 2);
    expect(storyCues(4.7).rise).toBe(1);
    expect(storyCues(4.7).bloom).toBeGreaterThanOrEqual(0.75);
    expect(storyCues(5).bloom).toBe(1);
  });
});
