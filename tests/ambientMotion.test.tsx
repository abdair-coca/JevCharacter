// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAmbientMotion } from "../src/hooks/useAmbientMotion";
import { useReducedMotionPreference } from "../src/hooks/useReducedMotionPreference";

vi.mock("motion/react", () => ({ useReducedMotion: () => false }));
afterEach(cleanup);

describe("ambient control lifecycle", () => {
  it("uses a static fallback when viewport observation is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const element = document.createElement("span");
    const { result } = renderHook(() => useAmbientMotion(useRef(element)));
    expect(result.current).toBe(false);
  });
  it("responds to reduced-motion changes without remounting", () => {
    const media = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal("matchMedia", () => media);
    const rendered = renderHook(useReducedMotionPreference);
    expect(rendered.result.current).toBe(false);
    act(() => { media.matches = true; media.dispatchEvent(new Event("change")); });
    expect(rendered.result.current).toBe(true);
    act(() => { media.matches = false; media.dispatchEvent(new Event("change")); });
    expect(rendered.result.current).toBe(false);
  });
  it("runs only in view and foreground, and disconnects on unmount", () => {
    let intersection: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    const element = document.createElement("span");
    const observe = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { intersection = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    let hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    const rendered = renderHook(() => useAmbientMotion(useRef(element)));
    expect(observe).toHaveBeenCalledWith(element);
    expect(rendered.result.current).toBe(false);
    const visibility = (isIntersecting: boolean) => act(() => intersection?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
    visibility(true);
    expect(rendered.result.current).toBe(true);
    act(() => { hidden = true; document.dispatchEvent(new Event("visibilitychange")); });
    expect(rendered.result.current).toBe(false);
    act(() => { hidden = false; document.dispatchEvent(new Event("visibilitychange")); });
    expect(rendered.result.current).toBe(true);
    visibility(false);
    expect(rendered.result.current).toBe(false);
    rendered.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
