// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Character from "../src/components/Character";

const runtime = vi.hoisted(() => ({ reduced: false }));
vi.mock("../src/hooks/useReducedMotionPreference", () => ({ useReducedMotionPreference: () => runtime.reduced }));
vi.mock("@rive-app/react-webgl2", () => {
  const rive = { pause: () => {}, stopRendering: () => {}, startRendering: () => {}, play: () => {}, resizeDrawingSurfaceToCanvas: () => {} };
  const RiveComponent = () => <canvas />;
  return {
    useRive: () => ({ rive, RiveComponent }),
    useViewModel: () => ({}),
    useViewModelInstance: () => ({}),
    useViewModelInstanceEnum: () => ({ value: "Base", setValue: () => {} }),
    useViewModelInstanceNumber: () => ({ value: 0, setValue: () => {} }),
    useViewModelInstanceTrigger: () => ({ trigger: () => {} }),
    Layout: class {}, Fit: { Contain: "contain" }, Alignment: { Center: "center" },
  };
});

beforeEach(() => { runtime.reduced = false; });
afterEach(cleanup);

describe("Character reveal timing", () => {
  it("reports the reveal once the 1.8s delay has elapsed after ready", async () => {
    const onPainted = vi.fn();
    const { container } = render(<Character active onPainted={onPainted} />);
    expect(container.querySelector(".character-rive")!.getAttribute("data-ready")).toBe("true");
    expect(onPainted).not.toHaveBeenCalled();
    await waitFor(() => expect(onPainted).toHaveBeenCalledOnce(), { timeout: 3000 });
  });

  it("cancels the pending reveal when it unmounts before the delay", async () => {
    const onPainted = vi.fn();
    render(<Character active onPainted={onPainted} />).unmount();
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(onPainted).not.toHaveBeenCalled();
  });

  it("uses the same delay under reduced motion", async () => {
    runtime.reduced = true;
    const onPainted = vi.fn();
    render(<Character active presentation staticPose onPainted={onPainted} />);
    await waitFor(() => expect(onPainted).toHaveBeenCalledOnce(), { timeout: 3000 });
  });
});
