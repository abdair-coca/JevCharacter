// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Character from "../src/components/Character";

const runtime = vi.hoisted(() => ({
  rive: { pause: vi.fn(), stopRendering: vi.fn(), startRendering: vi.fn(), play: vi.fn(), resizeDrawingSurfaceToCanvas: vi.fn() },
  state: vi.fn(), trigger: vi.fn(), shape: vi.fn(),
  load: vi.fn(), reduced: false,
}));
vi.mock("../src/hooks/useReducedMotionPreference", () => ({ useReducedMotionPreference: () => runtime.reduced }));
vi.mock("@rive-app/react-webgl2", () => {
  const viewModel = {};
  const instance = {};
  const RiveComponent = () => <canvas />;
  return {
    useRive: (options: unknown) => { runtime.load(options); return { rive: runtime.rive, RiveComponent }; },
    useViewModel: () => viewModel,
    useViewModelInstance: () => instance,
    useViewModelInstanceEnum: () => ({ value: "Base", setValue: runtime.state }),
    useViewModelInstanceNumber: () => ({ value: 0, setValue: runtime.shape }),
    useViewModelInstanceTrigger: () => ({ trigger: runtime.trigger }),
    Layout: class {}, Fit: { Contain: "contain" }, Alignment: { Center: "center" },
  };
});
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); runtime.reduced = false; });

describe("Character visibility", () => {
  it("stops Rive rendering while hidden and resumes the same canvas from a neutral state", () => {
    const onReady = vi.fn();
    const { container, rerender } = render(<Character active onReady={onReady} />);
    const canvas = container.querySelector("canvas");
    expect(onReady).toHaveBeenCalled();
    rerender(<Character active={false} onReady={onReady} />);
    expect(runtime.rive.pause).toHaveBeenCalled();
    expect(runtime.rive.stopRendering).toHaveBeenCalled();
    expect(container.querySelector("canvas")).toBe(canvas);
    runtime.rive.startRendering.mockClear();
    rerender(<Character active onReady={onReady} />);
    expect(runtime.state).toHaveBeenLastCalledWith("Base");
    expect(runtime.rive.resizeDrawingSurfaceToCanvas).toHaveBeenCalled();
    expect(runtime.rive.startRendering).toHaveBeenCalledOnce();
    expect(container.querySelector("canvas")).toBe(canvas);
  });
  it("provides presentation readiness without motion and disables Rive pointer listeners", () => {
    runtime.reduced = true;
    const onReady = vi.fn();
    render(<Character presentation onReady={onReady} />);
    expect(onReady).toHaveBeenCalled();
    expect(runtime.load).toHaveBeenCalledWith(expect.objectContaining({ shouldDisableRiveListeners: true, autoplay: false }));
    expect(runtime.rive.pause).toHaveBeenCalled();
    expect(runtime.rive.play).not.toHaveBeenCalled();
  });
});
