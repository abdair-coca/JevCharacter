// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCharacterController, type CharacterController } from "../src/character/useCharacterController";
import { BRAIN_CONFIG } from "../src/creature/brain/brainConfig";
import { mentionedMorphForms, requestedMorphForm } from "../src/creature/brain/morphIntent";
import { executeDecisionAction } from "../src/creature/rive/riveReactionAdapter";

describe("morph intent and execution", () => {
  it.each([
    ["hazte una estrella", "star"],
    ["turn into a square", "square"],
    ["morph into un triángulo", "triangle"],
  ] as const)("recognizes requested forms in %s", (message, form) => {
    expect(requestedMorphForm(message)).toBe(form);
  });

  it("leaves alternatives and negated mentions for Jev to interpret", () => {
    expect(mentionedMorphForms("estrella o triángulo")).toEqual(["star", "triangle"]);
    expect(requestedMorphForm("no quiero un triángulo")).toBeUndefined();
    expect(requestedMorphForm("not a square, make it a star")).toBeUndefined();
  });

  it("routes morph actions to the character morph method only", async () => {
    const characterMethods = {
      morph: vi.fn(),
      talk: vi.fn(),
      idle: vi.fn(),
      playFor: vi.fn(),
      answer: vi.fn(),
    };

    await executeDecisionAction(characterMethods as unknown as CharacterController, {
      action: { kind: "morph", form: "triangle" },
      actionConfidence: 1,
      reaction: "BASE",
      reactionConfidence: 1,
      probabilities: { BASE: 1, HELLO: 0, GHOST: 0, FLOWER: 0 },
      intensity: 0,
      wantsAttention: 0,
      source: "jev",
    });

    expect(characterMethods.morph).toHaveBeenCalledWith("triangle");
    expect(characterMethods.talk).not.toHaveBeenCalled();
  });

  it("returns a temporary morph to Base, unless another action interrupts it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    const setState = vi.fn();
    const trigger = vi.fn();
    const setShapeType = vi.fn();
    const { result, unmount } = renderHook(() => useCharacterController(setState, trigger, setShapeType));
    let morph!: Promise<void>;

    await act(async () => {
      morph = result.current.morph("star");
      await Promise.resolve();
    });
    expect(setState).toHaveBeenCalledWith("MorphState");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await morph;
    expect(setState).toHaveBeenLastCalledWith("Base");

    let interrupted!: Promise<void>;
    await act(async () => {
      interrupted = result.current.morph("square");
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.play("Hello");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await interrupted;
    expect(setState).toHaveBeenLastCalledWith("Hello");
    unmount();
  });

  it("ignores bumps during cooldown and allows one after it expires", async () => {
    const clock = { now: 2000 };
    vi.spyOn(performance, "now").mockImplementation(() => clock.now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    const setState = vi.fn();
    const trigger = vi.fn();
    const { result, unmount } = renderHook(() => useCharacterController(setState, trigger));

    await act(async () => {
      await result.current.bump();
      await result.current.bump();
    });

    expect(setState).toHaveBeenCalledWith("Base");
    expect(trigger).toHaveBeenCalledOnce();
    clock.now += BRAIN_CONFIG.bumpCooldownMs;
    await act(async () => {
      await result.current.bump();
    });
    expect(trigger).toHaveBeenCalledTimes(2);
    unmount();
  });
});
