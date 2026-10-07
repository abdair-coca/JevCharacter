import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import type { CharacterController } from "../../character/useCharacterController";
import { cssDurationSeconds } from "../../lib/motionTokens";
import { SHOWCASE_TIMING_TOKENS, type ShowcaseTimings } from "./catalog";
import { showcaseMachine, type ShowcasePort } from "./player";

function readTimings(): ShowcaseTimings {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(SHOWCASE_TIMING_TOKENS).map(([key, token]) => [key, cssDurationSeconds(css.getPropertyValue(token)) * 1000])) as ShowcaseTimings;
}

export function useShowcasePlayer(controller: RefObject<CharacterController | null>, visible: boolean, reduced: boolean) {
  const onFailure = useRef<() => void>(() => {});
  const epoch = useRef(0);
  const input = useMemo(() => {
    const port: ShowcasePort = {
      reset: () => {
        const generation = ++epoch.current;
        controller.current?.stop();
        void controller.current?.idle().catch(() => { if (generation === epoch.current) onFailure.current(); });
      },
      execute: action => {
        const generation = epoch.current;
        const promise = action.kind === "morph" ? controller.current?.morph(action.form)
          : action.state === "think" ? controller.current?.think() : controller.current?.play(action.state);
        void promise?.catch(() => { if (generation === epoch.current) onFailure.current(); });
      },
    };
    return { port, timings: readTimings(), reduced };
    // Mode changes go through events; the actor owns the only playback clock.
  }, [controller, reduced]);
  const actor = useActorRef(showcaseMachine, { input });
  const snapshot = useSelector(actor, value => value);
  useEffect(() => {
    onFailure.current = () => { if (!actor.getSnapshot().matches("error")) actor.send({ type: "ERROR" }); };
    return () => { onFailure.current = () => {}; };
  }, [actor]);
  useEffect(() => { actor.send({ type: visible ? "RESUME" : "SUSPEND" }); }, [actor, visible]);
  useEffect(() => { actor.send({ type: "MODE", reduced }); }, [actor, reduced]);
  useEffect(() => () => { epoch.current++; controller.current?.stop(); }, [controller]);
  return { actor, snapshot };
}
