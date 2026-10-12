import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference";
import { cssDurationSeconds } from "../lib/motionTokens";

import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceEnum,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
  Layout,
  Fit,
  Alignment,
} from "@rive-app/react-webgl2";

import {
  useCharacterController,
  type CharacterController,
} from "../character/useCharacterController";

const STATE_MACHINE = "State Machine 1";
// Keep in sync with the data-ready transition delay in App.css: Jev stays hidden for this long.
const REVEAL_DELAY_MS = 1800;

type Props = {
  onReady?: () => void;
  onPainted?: () => void;
  onError?: () => void;
  active?: boolean;
  presentation?: boolean;
  staticPose?: boolean;
};

const Character = forwardRef<CharacterController, Props>(
  function Character({ onReady, onPainted, onError, active = true, presentation = false, staticPose = false }, ref) {
    const motionPreference = useReducedMotionPreference();
    const reducedMotion = motionPreference || staticPose;
    const wasSuspended = useRef(false);
    const preparedPose = useRef(false);
    const canvasHost = useRef<HTMLDivElement | null>(null);
    const [staticPrepared, setStaticPrepared] = useState(false);
    // Keep immutable layout stable across unrelated React updates while paused.
    const layout = useMemo(() => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }), []);
    const { rive, RiveComponent } = useRive({
      src: "/rive/prove2.riv",
      stateMachine: STATE_MACHINE,
      autoplay: active && !reducedMotion,
      autoBind: true,
      shouldDisableRiveListeners: presentation,
      onLoadError: onError,

      layout,
    });

    const viewModel = useViewModel(rive, {
      name: "ViewModel1",
    });

    const viewModelInstance =
      useViewModelInstance(viewModel, {
        useDefault: true,
        rive,
      });

    const { value: stateValue, setValue: setState } =
      useViewModelInstanceEnum(
        "state",
        viewModelInstance
      );

    const { trigger: triggerState } =
      useViewModelInstanceTrigger(
        "trigState",
        viewModelInstance
      );

    const { value: shapeTypeValue, setValue: setShapeType } =
      useViewModelInstanceNumber("shapeType", viewModelInstance);

    const ready = Boolean(rive && viewModelInstance && typeof stateValue === "string");
    const resetShape = shapeTypeValue === null ? undefined : setShapeType;

    const character =
      useCharacterController(
        setState,
        triggerState,
         resetShape,
         active && ready && !(presentation && reducedMotion),
      );

    useImperativeHandle(
      ref,
      () => character,
      [character]
    );

    useEffect(() => {
      if (ready && active && (!reducedMotion || (presentation && staticPrepared))) onReady?.();
    }, [active, onReady, presentation, ready, reducedMotion, staticPrepared]);

    useEffect(() => {
      if (!ready || !onPainted) return;
      // Same delay as the CSS reveal: the creature becomes visible when this fires.
      const timeout = window.setTimeout(onPainted, REVEAL_DELAY_MS);
      return () => window.clearTimeout(timeout);
    }, [onPainted, ready]);

    useEffect(() => {
      if (!rive) return;
      if (!active) {
        wasSuspended.current = true;
        rive.pause();
        rive.stopRendering();
        return;
      }
      if (!presentation || !reducedMotion) preparedPose.current = false;
      if (presentation && reducedMotion && ready && wasSuspended.current && preparedPose.current) {
        wasSuspended.current = false;
        rive.pause();
        rive.stopRendering();
        return;
      }
      if (wasSuspended.current && ready) {
        wasSuspended.current = false;
        void character.idle();
      }
      rive.resizeDrawingSurfaceToCanvas();
      if (presentation && reducedMotion && ready) {
        let cancelled = false;
        let frame: number | null = null;
        let timer: number | null = null;
        const freeze = () => { rive.pause(); rive.stopRendering(); };
        // The deferred runtime needs initialization before it can freeze Base.
        // Warm only this invisible presentation for a bounded tokenized period;
        // show the authored pose after stopping, never visible reduced-motion
        // playback, pixel processing or a change to Home's defaults.
        void Promise.resolve().then(() => {
          if (cancelled) return;
          preparedPose.current = false;
          // Hide synchronously before starting the runtime, including a live
          // preference change when React has not committed the state update yet.
          canvasHost.current?.setAttribute("data-static-preparing", "true");
          setStaticPrepared(false);
          rive.play(STATE_MACHINE);
          resetShape?.(0);
          setState?.("Base");
          const duration = cssDurationSeconds(getComputedStyle(document.documentElement).getPropertyValue("--presentation-pose-warmup")) * 1000;
          frame = requestAnimationFrame(() => {
            frame = null;
            if (cancelled) return;
            try {
              triggerState?.();
              rive.startRendering();
              timer = window.setTimeout(() => {
                timer = null;
                if (cancelled) return;
                freeze();
                preparedPose.current = true;
                setStaticPrepared(true);
              }, duration);
            } catch { freeze(); onError?.(); }
          });
        }).catch(() => { if (!cancelled) { freeze(); onError?.(); } });
        return () => { cancelled = true; if (frame !== null) cancelAnimationFrame(frame); if (timer !== null) window.clearTimeout(timer); freeze(); };
      }
      rive.startRendering();
      if (reducedMotion) rive.pause();
      else rive.play();
    }, [active, character, onError, presentation, ready, reducedMotion, resetShape, rive, setState, triggerState]);

    return (
      <div
        ref={canvasHost}
        className="character-rive"
        data-ready={ready}
        data-state={stateValue ?? undefined}
        data-active={active}
        data-presentation={presentation}
        data-static-preparing={presentation && reducedMotion && !staticPrepared}
        aria-hidden="true"
      >
        <RiveComponent />
      </div>
    );
  }
);

export default memo(Character);
