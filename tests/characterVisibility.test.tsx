// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Character from "../src/components/Character";
import { preferencesStore } from "../src/stores/preferencesStore";

const runtime = vi.hoisted(() => ({
  rive: { pause: vi.fn(), stopRendering: vi.fn(), startRendering: vi.fn(), play: vi.fn(), resizeDrawingSurfaceToCanvas: vi.fn() },
  state: vi.fn(), trigger: vi.fn(), shape: vi.fn(), color: vi.fn(),
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
    useViewModelInstanceColor: () => ({ value: 0, setValue: runtime.color }),
    useViewModelInstanceTrigger: () => ({ trigger: runtime.trigger }),
    Layout: class {}, Fit: { Contain: "contain" }, Alignment: { Center: "center" },
    RuntimeLoader: { setWasmUrl: () => {} },
  };
});
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); runtime.reduced = false; document.documentElement.style.setProperty("--presentation-pose-warmup", "20ms"); });

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
  it("prepares an invisible static pose, then freezes before reporting readiness", async () => {
    runtime.reduced = true;
    const onReady = vi.fn();
    const { container } = render(<Character presentation onReady={onReady} />);
    expect(onReady).not.toHaveBeenCalled();
    expect(container.querySelector('.character-rive')?.getAttribute('data-static-preparing')).toBe('true');
    expect(runtime.load).toHaveBeenCalledWith(expect.objectContaining({ shouldDisableRiveListeners: true, autoplay: false }));
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce(), { timeout: 3000 });
    expect(runtime.rive.play).toHaveBeenCalledExactlyOnceWith("State Machine 1");
    expect(runtime.rive.pause).toHaveBeenCalled();
    expect(runtime.rive.startRendering).toHaveBeenCalledOnce();
    expect(runtime.rive.stopRendering).toHaveBeenCalledOnce();
    expect(onReady).toHaveBeenCalledOnce();
    expect(container.querySelector('.character-rive')?.getAttribute('data-static-preparing')).toBe('false');
    expect(runtime.rive.play.mock.invocationCallOrder[0]).toBeLessThan(runtime.rive.pause.mock.invocationCallOrder[0]);
    expect(runtime.rive.stopRendering.mock.invocationCallOrder[0]).toBeLessThan(onReady.mock.invocationCallOrder[0]);
  });
  it("cancels static pose preparation when the presentation hides before its frame", async () => {
    runtime.reduced = true;
    const { rerender } = render(<Character presentation active />);
    rerender(<Character presentation active={false} />);
    await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    expect(runtime.rive.play).not.toHaveBeenCalled();
    expect(runtime.rive.stopRendering).toHaveBeenCalled();
  });
  it("cancels an in-flight warmup without reporting stale readiness", async () => {
    document.documentElement.style.setProperty("--presentation-pose-warmup", "1000ms");
    runtime.reduced = true;
    const onReady = vi.fn();
    const { rerender } = render(<Character presentation active onReady={onReady} />);
    await waitFor(() => expect(runtime.rive.startRendering).toHaveBeenCalledOnce());
    const clear = vi.spyOn(window, "clearTimeout");
    rerender(<Character presentation active={false} onReady={onReady} />);
    expect(clear).toHaveBeenCalled();
    expect(runtime.rive.pause).toHaveBeenCalled();
    expect(runtime.rive.stopRendering).toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
    clear.mockRestore();
  });
  it("paints Jev's body with the chosen color and follows later changes", () => {
    preferencesStore.setState({ jevColor: "violet" });
    render(<Character active />);
    expect(runtime.color).toHaveBeenLastCalledWith(0xffd044ff);
    act(() => preferencesStore.getState().setJevColor("cyan"));
    expect(runtime.color).toHaveBeenLastCalledWith(0xff00c8ff);
    act(() => preferencesStore.setState({ jevColor: "violet" }));
  });
  it("preserves the same layout instance across presentation updates", () => {
    const onReady = vi.fn();
    const { rerender } = render(<Character presentation onReady={onReady} />);
    const layout = (runtime.load.mock.calls[0][0] as { layout: unknown }).layout;
    rerender(<Character presentation onReady={vi.fn()} />);
    expect((runtime.load.mock.calls.at(-1)![0] as { layout: unknown }).layout).toBe(layout);
  });
  it("resumes an already prepared static pose without replaying its warmup", async () => {
    runtime.reduced = true;
    const onReady = vi.fn();
    const { container, rerender } = render(<Character presentation active onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce(), { timeout: 3000 });
    runtime.rive.play.mockClear(); runtime.rive.startRendering.mockClear();
    rerender(<Character presentation active={false} onReady={onReady} />);
    rerender(<Character presentation active onReady={onReady} />);
    await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    expect(runtime.rive.play).not.toHaveBeenCalled();
    expect(runtime.rive.startRendering).not.toHaveBeenCalled();
    expect(container.querySelector('.character-rive')?.getAttribute('data-static-preparing')).toBe('false');
  });
});
