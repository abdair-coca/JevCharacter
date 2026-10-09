// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStoryScroll } from "../src/features/story/useStoryScroll";

const mocks = vi.hoisted(() => ({
  triggers: [] as { kind: string; enable: ReturnType<typeof vi.fn>; disable: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> }[],
  lease: { setActive: vi.fn(), release: vi.fn(), scrollTo: vi.fn() },
  acquire: vi.fn(), visibility: vi.fn(), releaseEngine: vi.fn(), select: vi.fn(),
  settle: { pause: vi.fn(), resume: vi.fn(), kill: vi.fn() },
}));
vi.mock("../src/features/presentation/scrollRuntime", () => ({
  acquirePresentationScroll: mocks.acquire, enablePresentationEngine: vi.fn(),
  releaseIdlePresentationEngine: mocks.releaseEngine, setPresentationVisibility: mocks.visibility,
}));
vi.mock("@gsap/react", async () => {
  const { useLayoutEffect } = await import("react");
  return { useGSAP: (callback: () => (() => void), config: { dependencies: readonly unknown[] }) => useLayoutEffect(callback, config.dependencies) };
});
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {
  create: (options: { pin?: boolean; onUpdate?: () => void }) => {
    const trigger = { kind: options.pin ? "pin" : options.onUpdate ? "journey" : "selection", enable: vi.fn(), disable: vi.fn(), update: vi.fn(), kill: vi.fn() };
    mocks.triggers.push(trigger); return trigger;
  }, refresh: vi.fn(), update: vi.fn(),
} }));
vi.mock("gsap", () => ({ gsap: {
  registerPlugin: vi.fn(), set: vi.fn(),
  quickTo: () => Object.assign(vi.fn(), { tween: mocks.settle }),
  matchMedia: () => {
    let release: (() => void) | undefined;
    return { add: (_query: string, callback: () => (() => void)) => { release = callback(); }, revert: () => release?.() };
  },
  timeline: () => {
    const trigger = { kind: "journey", enable: vi.fn(), disable: vi.fn(), update: vi.fn(), kill: vi.fn() };
    mocks.triggers.push(trigger);
    const timeline = { scrollTrigger: trigger, to: (_target: unknown, _values: unknown, _position: number) => timeline };
    return timeline;
  },
} }));

let root: { current: HTMLElement };
let stage: { current: HTMLDivElement };
const options = { onScene: mocks.select, active: true, visible: true, reduced: false, preferenceKey: "es-light", selected: 0 };
beforeEach(() => {
  mocks.triggers.length = 0; vi.clearAllMocks(); mocks.acquire.mockReturnValue(mocks.lease);
  document.body.innerHTML = '<header class="site-header"></header><main style="--story-pin-gap:16px;--story-scroll-lerp:0.12;--story-follow:900ms;--story-jump:1800ms;--story-lift:0.04;--story-travel:0.25"><div class="story-workspace"><div class="story-stage"><div class="story-flight"></div></div></div></main>';
  root = { current: document.querySelector("main")! };
  stage = { current: document.querySelector<HTMLDivElement>(".story-stage")! };
  for (let index = 0; index < 5; index++) {
    const section = document.createElement("section"); section.dataset.storyScene = String(index); root.current.append(section);
  }
});
afterEach(() => { cleanup(); document.body.innerHTML = ""; });

describe("story scroll resource ownership", () => {
  it("animates reveal but preserves instant geometry restoration", () => {
    const result = renderHook(props => useStoryScroll(root, stage, props), { initialProps: options });
    result.result.current.reveal();
    expect(mocks.lease.scrollTo).toHaveBeenLastCalledWith(expect.any(Number), 1.8);
    result.result.current.refresh();
    expect(mocks.lease.scrollTo).toHaveBeenLastCalledWith(expect.any(Number));
  });
  it("keeps pin geometry responsive offscreen so returning can make the stage visible again", () => {
    const result = renderHook(props => useStoryScroll(root, stage, props), { initialProps: options });
    result.rerender({ ...options, active: false });
    const pin = mocks.triggers.find(trigger => trigger.kind === "pin")!;
    expect(pin.disable).not.toHaveBeenCalled();
    expect(pin.update).toHaveBeenCalled();
    expect(mocks.triggers.find(trigger => trigger.kind === "journey")!.disable).toHaveBeenCalledWith(false);
    expect(mocks.settle.pause).toHaveBeenCalled();
  });
  it("suspends visual triggers offscreen while keeping narrative selection available", () => {
    const result = renderHook(props => useStoryScroll(root, stage, props), { initialProps: options });
    result.rerender({ ...options, active: false });
    expect(mocks.lease.setActive).toHaveBeenLastCalledWith(false);
    for (const trigger of mocks.triggers.filter(value => value.kind === "journey")) expect(trigger.disable).toHaveBeenCalledWith(false);
    for (const trigger of mocks.triggers.filter(value => value.kind === "selection")) expect(trigger.disable).not.toHaveBeenCalled();
    expect(mocks.visibility).toHaveBeenLastCalledWith(true);
    result.rerender(options);
    for (const trigger of mocks.triggers.filter(value => value.kind !== "selection")) expect(trigger.enable).toHaveBeenCalledWith(false, false);
  });

  it("reasserts offscreen suspension when the document engine resumes", () => {
    const result = renderHook(props => useStoryScroll(root, stage, props), { initialProps: { ...options, active: false } });
    result.rerender({ ...options, active: false, visible: false });
    expect(mocks.visibility).toHaveBeenLastCalledWith(false);
    const visual = mocks.triggers.filter(value => value.kind !== "selection");
    visual.forEach(trigger => trigger.disable.mockClear());
    result.rerender({ ...options, active: false, visible: true });
    expect(mocks.visibility).toHaveBeenLastCalledWith(true);
    for (const trigger of visual.filter(value => value.kind === "journey")) expect(trigger.disable).toHaveBeenCalledWith(false);
  });

  it("releases the scroll lease when switching to static reading and on unmount", () => {
    const result = renderHook(props => useStoryScroll(root, stage, props), { initialProps: options });
    expect(mocks.acquire).toHaveBeenCalledOnce();
    result.rerender({ ...options, reduced: true });
    expect(mocks.lease.release).toHaveBeenCalledOnce();
    expect(mocks.acquire).toHaveBeenCalledOnce();
    result.unmount();
    expect(mocks.releaseEngine).toHaveBeenCalled();
    expect(mocks.settle.kill).toHaveBeenCalled();
    for (const trigger of mocks.triggers.filter(value => value.kind === "selection")) expect(trigger.kill).toHaveBeenCalled();
  });
});
