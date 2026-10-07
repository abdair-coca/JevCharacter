// @vitest-environment jsdom
import { StrictMode, type PropsWithChildren } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CharacterController } from "../src/character/useCharacterController";
import { SHOWCASE_TIMING_TOKENS } from "../src/features/showcase/catalog";
import { useShowcasePlayer } from "../src/features/showcase/useShowcasePlayer";

const methods = {
  stop: vi.fn(), idle: vi.fn(async () => {}), play: vi.fn(async () => {}), think: vi.fn(async () => {}), morph: vi.fn(async () => {}),
  playFor: vi.fn(async () => {}), sequence: vi.fn(async () => {}), bump: vi.fn(async () => {}),
  hello: vi.fn(async () => {}), ghost: vi.fn(async () => {}), flower: vi.fn(async () => {}), talk: vi.fn(async () => {}), answer: vi.fn(async () => {}), cloud: vi.fn(async () => {}),
} satisfies CharacterController;
const controller = { current: methods };
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.values(SHOWCASE_TIMING_TOKENS).forEach(token => document.documentElement.style.setProperty(token, "10ms"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("showcase actor lifecycle", () => {
  it("survives Strict Mode without duplicate execution and releases work on unmount", () => {
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const { result, unmount } = renderHook(() => useShowcasePlayer(controller, true, false), { wrapper });
    act(() => { result.current.actor.send({ type: "READY" }); vi.advanceTimersByTime(10); });
    expect(methods.play).toHaveBeenCalledExactlyOnceWith("Base");
    unmount();
    methods.play.mockClear();
    act(() => vi.advanceTimersByTime(1000));
    expect(methods.play).not.toHaveBeenCalled();
    expect(methods.stop).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("pauses actual controller dispatch and resumes without changing the selected chapter", () => {
    const { result, rerender } = renderHook(({ visible }) => useShowcasePlayer(controller, visible, false), { initialProps: { visible: true } });
    act(() => { result.current.actor.send({ type: "SELECT", chapter: 5 }); result.current.actor.send({ type: "READY" }); vi.advanceTimersByTime(10); });
    expect(methods.morph).toHaveBeenCalledWith("star");
    rerender({ visible: false });
    methods.morph.mockClear();
    act(() => vi.advanceTimersByTime(1000));
    expect(methods.morph).not.toHaveBeenCalled();
    rerender({ visible: true });
    act(() => vi.advanceTimersByTime(10));
    expect(methods.morph).toHaveBeenCalledExactlyOnceWith("star");
    expect(result.current.snapshot.context.chapter).toBe(5);
  });
  it("keeps reduced-motion playback static and switches live without remounting the actor", () => {
    const { result, rerender } = renderHook(({ reduced }) => useShowcasePlayer(controller, true, reduced), { initialProps: { reduced: true } });
    const actor = result.current.actor;
    act(() => { actor.send({ type: "READY" }); actor.send({ type: "SELECT", chapter: 1 }); });
    expect(result.current.snapshot.matches("static")).toBe(true);
    expect(methods.play).not.toHaveBeenCalled();
    rerender({ reduced: false });
    act(() => vi.advanceTimersByTime(10));
    expect(result.current.actor).toBe(actor);
    expect(methods.play).toHaveBeenCalledWith("Hello");
  });
  it("rejects current actuator failures but discards errors from a replaced generation", async () => {
    let rejectPrevious: (error: Error) => void = () => {};
    methods.play.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectPrevious = reject; }));
    const { result } = renderHook(() => useShowcasePlayer(controller, true, false));
    act(() => { result.current.actor.send({ type: "READY" }); vi.advanceTimersByTime(10); result.current.actor.send({ type: "SELECT", chapter: 5 }); });
    await act(async () => { rejectPrevious(new Error("superseded")); await Promise.resolve(); });
    expect(result.current.snapshot.matches("error")).toBe(false);
    methods.morph.mockRejectedValueOnce(new Error("current failure"));
    await act(async () => { vi.advanceTimersByTime(10); await Promise.resolve(); });
    expect(result.current.snapshot.matches("error")).toBe(true);
  });
});
