import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
} from "react";

import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceEnum,
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
};

const Character = forwardRef<CharacterController, Props>(
  function Character({ onReady }, ref) {
    const { rive, RiveComponent } = useRive({
      src: "/rive/character.riv",
      stateMachine: STATE_MACHINE,
      autoplay: true,
      autoBind: true,
      shouldDisableRiveListeners: false,

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

    const { setValue: setState } =
      useViewModelInstanceEnum(
        "state",
        viewModelInstance
      );

    const { trigger: triggerState } =
      useViewModelInstanceTrigger(
        "trigState",
        viewModelInstance
      );

    const character =
      useCharacterController(
        setState,
        triggerState,
      );

    useImperativeHandle(
      ref,
      () => character,
      [character]
    );

    useEffect(() => {
      if (rive) onReady?.();
    }, [onReady, rive]);

    return (
      <div
        className="character-rive"
        aria-hidden="true"
      >
        <RiveComponent />
      </div>
    );
  }
);

export default memo(Character);
