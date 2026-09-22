import { useCallback, useRef } from "react";

import { BRAIN_CONFIG } from "../creature/brain/brainConfig";

export const CHARACTER_STATES = [
  "Base",
  "Hello",
  "Ghost",
  "Flower",
  "Talk",
  "Cloud",
] as const;

export type CharacterState = (typeof CHARACTER_STATES)[number];

type SetState = ((value: string) => void) | undefined;
type Trigger = (() => void) | undefined;

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
    [setRiveState, triggerState]
  );

  // Reproduce un estado manualmente
  const play = useCallback(
    async (state: CharacterState) => {
      const id = ++executionId.current;
      await rawPlay(state, id);
    },
    [rawPlay]
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
  }, []);

  return {
    play,
    playFor,
    sequence,
    stop,
    bump,

    idle: () => play("Base"),
    hello: () => play("Hello"),
    ghost: () => play("Ghost"),
    flower: () => play("Flower"),
    talk: () => playFor("Talk", BRAIN_CONFIG.talkDurationMs),
    cloud: () => playFor("Cloud", BRAIN_CONFIG.cloudDurationMs),
  };
}
export type CharacterController =
  ReturnType<typeof useCharacterController>;
