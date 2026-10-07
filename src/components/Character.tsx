import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference";

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

type Props = {
  onReady?: () => void;
  onError?: () => void;
  active?: boolean;
  presentation?: boolean;
  staticPose?: boolean;
};

const Character = forwardRef<CharacterController, Props>(
  function Character({ onReady, onError, active = true, presentation = false, staticPose = false }, ref) {
    const motionPreference = useReducedMotionPreference();
    const reducedMotion = motionPreference || staticPose;
    const wasSuspended = useRef(false);
    const { rive, RiveComponent } = useRive({
      src: "/rive/prove2.riv",
      stateMachine: STATE_MACHINE,
      autoplay: active && !reducedMotion,
      autoBind: true,
      shouldDisableRiveListeners: presentation,
      onLoadError: onError,

      layout: new Layout({
        fit: Fit.Contain,
        alignment: Alignment.Center,
      }),
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

    const character =
      useCharacterController(
        setState,
        triggerState,
        shapeTypeValue === null ? undefined : setShapeType,
        active && ready,
      );

    useImperativeHandle(
      ref,
      () => character,
      [character]
    );

    useEffect(() => {
      if (ready && active && (presentation || !reducedMotion)) onReady?.();
    }, [active, onReady, presentation, ready, reducedMotion]);

    useEffect(() => {
      if (!rive) return;
      if (!active) {
        wasSuspended.current = true;
        rive.pause();
        rive.stopRendering();
        return;
      }
      if (wasSuspended.current && ready) {
        wasSuspended.current = false;
        void character.idle();
      }
      rive.resizeDrawingSurfaceToCanvas();
      rive.startRendering();
      if (reducedMotion) rive.pause();
      else rive.play();
    }, [active, character, ready, reducedMotion, rive]);

    return (
      <div
        className="character-rive"
        data-ready={ready}
        data-state={stateValue ?? undefined}
        data-active={active}
        data-presentation={presentation}
        aria-hidden="true"
      >
        <RiveComponent />
      </div>
    );
  }
);

export default memo(Character);
