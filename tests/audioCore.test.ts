// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createAudioCore } from "../src/lib/audioCore";
import { FakeContext, reaches, type FakeNode } from "./audioFakes";

describe("shared audio core", () => {
  it("creates one context on the first gesture, with voice and music buses", () => {
    const create = vi.fn(() => new FakeContext() as unknown as AudioContext);
    const core = createAudioCore({ createContext: create });
    expect(core.bus("voice")).toBeNull();
    core.unlock();
    core.unlock();
    expect(create).toHaveBeenCalledOnce();
    expect(core.bus("voice")).not.toBeNull();
    expect(core.bus("music")).not.toBe(core.bus("voice"));
    expect(core.audible()).toBe(true);
  });

  it("keeps Jev's voice dry: only the music feeds the hall", () => {
    const context = new FakeContext();
    const core = createAudioCore({ createContext: () => context as unknown as AudioContext });
    core.unlock();
    const [hall] = context.convolvers;
    expect(reaches(core.bus("music") as unknown as FakeNode, hall)).toBe(true);
    expect(reaches(core.bus("voice") as unknown as FakeNode, hall)).toBe(false);
  });

  it("does not create audio while sound is off, and notifies every change", () => {
    const create = vi.fn(() => new FakeContext() as unknown as AudioContext);
    const core = createAudioCore({ createContext: create });
    const listener = vi.fn();
    const unsubscribe = core.subscribe(listener);
    core.setEnabled(false);
    core.unlock();
    expect(create).not.toHaveBeenCalled();
    core.setEnabled(true);
    core.unlock();
    expect(core.audible()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    core.setEnabled(false);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("suspends with a hidden tab and resumes when visible again", () => {
    const context = new FakeContext();
    const core = createAudioCore({ createContext: () => context as unknown as AudioContext });
    core.unlock();
    core.setHidden(true);
    expect(core.audible()).toBe(false);
    expect(context.suspend).toHaveBeenCalledOnce();
    core.setHidden(false);
    expect(context.resume).toHaveBeenCalledOnce();
    expect(core.audible()).toBe(true);
  });
});
