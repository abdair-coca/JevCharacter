import { useCallback, useRef } from "react";

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
  triggerState: Trigger
) {
  const executionId = useRef(0);

  // Función interna.
  // No cancela secuencias por sí misma.
  const rawPlay = useCallback(
    async (state: CharacterState) => {
      if (!setRiveState || !triggerState) return;

      // Cambiamos el enum
      setRiveState(state);

      // Dejamos que Rive procese el cambio
      await nextFrame();

      // Disparamos la transición
      triggerState();
    },
    [setRiveState, triggerState]
  );

  // Reproduce un estado manualmente
  const play = useCallback(
    async (state: CharacterState) => {
      executionId.current++;
      await rawPlay(state);
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

      await rawPlay(state);
      await sleep(duration);

      // Si otra animación empezó, cancelamos esta
      if (id !== executionId.current) return;

      await rawPlay("Base");
    },
    [rawPlay]
  );

  // Secuencia de animaciones
  const sequence = useCallback(
    async (steps: SequenceStep[]) => {
      const id = ++executionId.current;

      for (const step of steps) {
        if (id !== executionId.current) return;

        await rawPlay(step.state);
        await sleep(step.duration);
      }

      if (id === executionId.current) {
        await rawPlay("Base");
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

    idle: () => play("Base"),
    hello: () => play("Hello"),
    ghost: () => play("Ghost"),
    flower: () => play("Flower"),
    talk: () => play("Talk"),
    cloud: () => play("Cloud"),
  };
}
export type CharacterController =
  ReturnType<typeof useCharacterController>;