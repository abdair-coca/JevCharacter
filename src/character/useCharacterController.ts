import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { BRAIN_CONFIG } from "../creature/brain/brainConfig";
import type { BinaryAnswer, MorphForm, TalkState } from "../creature/brain/brain.types";

export const CHARACTER_STATES = ["Base", "Hello", "Ghost", "Flower", "Talk", "Cloud", "yes", "no", "talkb", "talkc", "talkbc"] as const;
export type CharacterState = (typeof CHARACTER_STATES)[number];
type SetState = ((value: string) => void) | undefined;
type SetNumber = ((value: number) => void) | undefined;
type Trigger = (() => void) | undefined;
type SequenceStep = { state: CharacterState; duration: number };
const MORPH_STATE: Record<MorphForm, string> = { star: "MorphState", square: "square", triangle: "triangle" };

export function useCharacterController(setRiveState: SetState, triggerState: Trigger, setShapeType?: SetNumber, active = true) {
  const executionId = useRef(0);
  const enabled = useRef(active);
  const currentState = useRef<CharacterState>("Base");
  const lastBumpAt = useRef(0);
  const pending = useRef(new Set<() => void>());

  const stop = useCallback(() => {
    executionId.current++;
    for (const cancel of pending.current) cancel();
    pending.current.clear();
  }, []);

  // Every wait can be cancelled and settled: neither timers nor unresolved
  // promises survive a replacement, suspension, or component teardown.
  const wait = useCallback((milliseconds?: number) => new Promise<boolean>(resolve => {
    if (!enabled.current) { resolve(false); return; }
    const cancel = () => {
      if (milliseconds === undefined) cancelAnimationFrame(id);
      else window.clearTimeout(id);
      pending.current.delete(cancel);
      resolve(false);
    };
    const finish = () => { pending.current.delete(cancel); resolve(true); };
    const id = milliseconds === undefined ? requestAnimationFrame(finish) : window.setTimeout(finish, milliseconds);
    pending.current.add(cancel);
  }), []);

  useLayoutEffect(() => {
    enabled.current = active;
    if (!active) stop();
    return () => { enabled.current = false; stop(); };
  }, [active, stop]);

  const rawPlay = useCallback(async (state: CharacterState, id: number) => {
    if (!enabled.current || id !== executionId.current || !setRiveState || !triggerState) return;
    setShapeType?.(0);
    setRiveState(state);
    if (!await wait() || !enabled.current || id !== executionId.current) return;
    currentState.current = state;
    triggerState();
  }, [setRiveState, setShapeType, triggerState, wait]);

  const play = useCallback(async (state: CharacterState) => {
    if (!enabled.current) return;
    stop();
    await rawPlay(state, executionId.current);
  }, [rawPlay, stop]);

  const playFor = useCallback(async (state: CharacterState, duration = 1500) => {
    if (!enabled.current) return;
    stop();
    const id = executionId.current;
    await rawPlay(state, id);
    if (id !== executionId.current || !await wait(duration)) return;
    await rawPlay("Base", id);
  }, [rawPlay, stop, wait]);

  const think = useCallback(async () => {
    if (!enabled.current || !setRiveState || !triggerState) return;
    stop();
    const id = executionId.current;
    setShapeType?.(0);
    setRiveState("think");
    if (await wait() && enabled.current && id === executionId.current) triggerState();
  }, [setRiveState, setShapeType, stop, triggerState, wait]);

  const morph = useCallback(async (form: MorphForm) => {
    if (!enabled.current || !setRiveState || !triggerState) return;
    stop();
    const id = executionId.current;
    currentState.current = "Base";
    setRiveState(MORPH_STATE[form]);
    if (!await wait() || !enabled.current || id !== executionId.current) return;
    triggerState();
    if (!await wait(BRAIN_CONFIG.morphDurationMs) || id !== executionId.current) return;
    await rawPlay("Base", id);
  }, [rawPlay, setRiveState, stop, triggerState, wait]);

  const sequence = useCallback(async (steps: SequenceStep[]) => {
    if (!enabled.current) return;
    stop();
    const id = executionId.current;
    for (const step of steps) {
      if (id !== executionId.current) return;
      await rawPlay(step.state, id);
      if (id !== executionId.current || !await wait(step.duration)) return;
    }
    await rawPlay("Base", id);
  }, [rawPlay, stop, wait]);

  const bump = useCallback(async () => {
    const now = performance.now();
    if (!enabled.current || !setRiveState || !triggerState || now - lastBumpAt.current < BRAIN_CONFIG.bumpCooldownMs) return;
    const id = executionId.current;
    lastBumpAt.current = now;
    setRiveState(currentState.current);
    if (await wait() && enabled.current && id === executionId.current) triggerState();
  }, [setRiveState, triggerState, wait]);

  return useMemo(() => ({
    play, think, playFor, sequence, stop, bump, morph,
    idle: () => play("Base"), hello: () => play("Hello"), ghost: () => play("Ghost"), flower: () => play("Flower"),
    talk: (state: TalkState = "Talk") => playFor(state, BRAIN_CONFIG.talkDurationMs),
    answer: (answer: BinaryAnswer) => playFor(answer, BRAIN_CONFIG.yesNoDurationMs),
    cloud: () => playFor("Cloud", BRAIN_CONFIG.cloudDurationMs),
  }), [bump, morph, play, playFor, sequence, stop, think]);
}

export type CharacterController = ReturnType<typeof useCharacterController>;
