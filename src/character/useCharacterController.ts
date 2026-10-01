import { useCallback, useRef } from "react";

import { BRAIN_CONFIG } from "../creature/brain/brainConfig";
import type {
  BinaryAnswer,
  MorphForm,
  TalkState,
} from "../creature/brain/brain.types";

export const CHARACTER_STATES = [
  "Base",
  "Hello",
  "Ghost",
  "Flower",
  "Talk",
  "Cloud",
  "yes",
  "no",
  "talkb",
  "talkc",
  "talkbc",
] as const;

export type CharacterState = (typeof CHARACTER_STATES)[number];

type SetState = ((value: string) => void) | undefined;
type SetNumber = ((value: number) => void) | undefined;
type Trigger = (() => void) | undefined;

const MORPH_STATE: Record<MorphForm, string> = {
  star: "MorphState",
  square: "square",
  triangle: "triangle",
};

type SequenceStep = {
  state: CharacterState;
  duration: number;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

export function useCharacterController(
  setRiveState: SetState,
  triggerState: Trigger,
  setShapeType?: SetNumber,
) {
  const executionId = useRef(0);
  const currentState = useRef<CharacterState>("Base");
  const lastBumpAt = useRef(0);

  const bump = useCallback(async () => {
    const now = performance.now();
    if (!setRiveState || !triggerState || now - lastBumpAt.current < BRAIN_CONFIG.bumpCooldownMs) return;

    lastBumpAt.current = now;
    const state = currentState.current;
    setRiveState(state);
    await nextFrame();
    triggerState();
  }, [setRiveState, triggerState]);

  // Función interna.
  // No cancela secuencias por sí misma.
  const rawPlay = useCallback(
    async (state: CharacterState, expectedExecutionId?: number) => {
      if (!setRiveState || !triggerState) return;

      // Any new ordinary state cancels an active temporary morph.
      setShapeType?.(0);

      // Cambiamos el enum
      setRiveState(state);

      // Dejamos que Rive procese el cambio
      await nextFrame();

      if (expectedExecutionId !== undefined && expectedExecutionId !== executionId.current) return;

      currentState.current = state;

      // Disparamos la transición
      triggerState();

      // The state trigger is also the Rive-native bump for a form change.
      // Do not fire a second animation here: it makes quick transitions feel noisy.
    },
    [setRiveState, setShapeType, triggerState]
  );

  // Reproduce un estado manualmente
  const play = useCallback(
    async (state: CharacterState) => {
      const id = ++executionId.current;
      await rawPlay(state, id);
    },
    [rawPlay]
  );

  const think = useCallback(async () => {
    if (!setRiveState || !triggerState) return;

    const id = ++executionId.current;
    setShapeType?.(0);
    setRiveState("think");
    await nextFrame();
    if (id !== executionId.current) return;
    triggerState();
  }, [setRiveState, setShapeType, triggerState]);

  const morph = useCallback(
    async (form: MorphForm) => {
      if (!setRiveState || !triggerState) return;

      const id = ++executionId.current;
      currentState.current = "Base";
      setRiveState(MORPH_STATE[form]);
      await nextFrame();
      if (id !== executionId.current) return;
      triggerState();

      await sleep(BRAIN_CONFIG.morphDurationMs);
      if (id !== executionId.current) return;

      await nextFrame();
      if (id !== executionId.current) return;
      await rawPlay("Base", id);
    },
    [rawPlay, setRiveState, setShapeType, triggerState],
  );

  // Reproduce un estado y vuelve a Base
  const playFor = useCallback(
    async (
      state: CharacterState,
      duration = 1500
    ) => {
      const id = ++executionId.current;

      await rawPlay(state, id);
      await sleep(duration);

      // Si otra animación empezó, cancelamos esta
      if (id !== executionId.current) return;

      await rawPlay("Base", id);
    },
    [rawPlay]
  );

  // Secuencia de animaciones
  const sequence = useCallback(
    async (steps: SequenceStep[]) => {
      const id = ++executionId.current;

      for (const step of steps) {
        if (id !== executionId.current) return;

        await rawPlay(step.state, id);
        await sleep(step.duration);
      }

      if (id === executionId.current) {
        await rawPlay("Base", id);
      }
    },
    [rawPlay]
  );

  const stop = useCallback(() => {
    executionId.current++;
    setShapeType?.(0);
  }, [setShapeType]);

  return {
    play,
    think,
    playFor,
    sequence,
    stop,
    bump,

    idle: () => play("Base"),
    hello: () => play("Hello"),
    ghost: () => play("Ghost"),
    flower: () => play("Flower"),
    talk: (state: TalkState = "Talk") => playFor(state, BRAIN_CONFIG.talkDurationMs),
    answer: (answer: BinaryAnswer) => playFor(answer, BRAIN_CONFIG.yesNoDurationMs),
    morph,
    cloud: () => playFor("Cloud", BRAIN_CONFIG.cloudDurationMs),
  };
}
export type CharacterController =
  ReturnType<typeof useCharacterController>;
