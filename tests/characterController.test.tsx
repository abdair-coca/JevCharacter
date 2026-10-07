// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCharacterController } from "../src/character/useCharacterController";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
});
afterEach(cleanup);

function mountController() {
  const state = vi.fn();
  const trigger = vi.fn();
  const shape = vi.fn();
  return { ...renderHook(({ active }) => useCharacterController(state, trigger, shape, active), { initialProps: { active: true } }), state, trigger };
}

describe("character lifecycle", () => {
  it("cancels morph hold timers when hidden and never restores an obsolete pose later", async () => {
    const { result, rerender, state, trigger } = mountController();
    let morph: Promise<void>;
    act(() => { morph = result.current.morph("triangle"); });
    await act(async () => vi.advanceTimersByTimeAsync(16));
    expect(state).toHaveBeenLastCalledWith("triangle");
    expect(trigger).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    rerender({ active: false });
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await morph; });
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(state).toHaveBeenCalledTimes(1);
    await act(async () => result.current.hello());
    expect(state).toHaveBeenCalledTimes(1);
    rerender({ active: true });
    act(() => { void result.current.idle(); });
    await act(async () => vi.advanceTimersByTimeAsync(16));
    expect(state).toHaveBeenLastCalledWith("Base");
  });

  it("settles and cancels pending frames on unmount", async () => {
    const { result, unmount, trigger } = mountController();
    let thinking: Promise<void>;
    act(() => { thinking = result.current.think(); });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await thinking; });
    expect(trigger).not.toHaveBeenCalled();
  });

  it("replaces a temporary action without a stale return-to-base", async () => {
    const { result, state } = mountController();
    act(() => { void result.current.playFor("Hello", 500); });
    await act(async () => vi.advanceTimersByTimeAsync(16));
    act(() => { void result.current.play("Flower"); });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(state.mock.calls.map(([name]) => name)).toEqual(["Hello", "Flower"]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
