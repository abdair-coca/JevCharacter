// @vitest-environment jsdom
import { LazyMotion, domAnimation } from "motion/react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AboutPage from "../src/pages/AboutPage";
import { preferencesStore } from "../src/stores/preferencesStore";
import type { CharacterController } from "../src/character/useCharacterController";

type CharacterProps = { onReady?: () => void; onError?: () => void; active?: boolean; presentation?: boolean; staticPose?: boolean };
const mocks = vi.hoisted(() => ({
  jump: vi.fn(), refresh: vi.fn(), reveal: vi.fn(), progress: { current: 0 }, reduced: false, inView: true, characters: [] as CharacterProps[],
  selectScene: (_index: number) => {},
}));
vi.mock("../src/features/story/useStoryScroll", () => ({ useStoryScroll: (_root: unknown, _stage: unknown, options: { onScene: (index: number) => void }) => {
  mocks.selectScene = options.onScene;
  return { reveal: mocks.reveal, progress: mocks.progress };
} }));
vi.mock("../src/features/story/ParticleVortex", () => ({ ParticleVortex: () => <canvas data-testid="particles" /> }));
vi.mock("../src/features/presentation/useStageVisibility", () => ({ useStageVisibility: () => mocks.inView }));
vi.mock("../src/hooks/useReducedMotionPreference", () => ({ useReducedMotionPreference: () => mocks.reduced }));
vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }), cssDurationSeconds: () => 0.2 }));
vi.mock("../src/components/Character", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  const noop = async () => {};
  const controller = { idle: noop, stop: vi.fn(), play: noop, think: noop, morph: noop, playFor: noop, sequence: noop, bump: noop, hello: noop, ghost: noop, flower: noop, talk: noop, answer: noop, cloud: noop } satisfies CharacterController;
  return { default: forwardRef<CharacterController, CharacterProps>(function MockStoryCharacter(props, ref) {
    useImperativeHandle(ref, () => controller, []);
    mocks.characters.push(props);
    return <div data-testid="story-character" data-active={props.active} data-static={props.staticPose} />;
  }) };
});

const view = () => <LazyMotion features={domAnimation}><AboutPage /></LazyMotion>;
const latest = () => mocks.characters.at(-1)!;
beforeEach(() => {
  mocks.characters.length = 0; mocks.reduced = false; mocks.inView = true;
  vi.clearAllMocks();
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  preferencesStore.setState({ language: "es", theme: "light", themePreference: "light" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("About narrative and presentation boundary", () => {
  it("provides five linear scenes, original attribution and explicitly future vision without a network request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(view());
    // Jev loads at the first particle change, so the test enters Bob before expecting the character.
    act(() => mocks.selectScene(1));
    await screen.findByTestId("story-character");
    expect(screen.getAllByRole("region")).toHaveLength(5);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ideas que\ncobran vida.");
    expect(screen.getByText(/Soy Abdair Coca/)).toBeTruthy();
    expect(screen.getByText(/Soy Abdair Coca/).textContent).toContain("Ingeniería Informática");
    expect(screen.getByText(/Mi primer gran proyecto/).textContent).toContain("memoria persistente");
    expect(screen.getByText(/Programación orientada a objetos/)).toBeTruthy();
    expect(screen.getByText(/Algoritmos que puedes explorar/)).toBeTruthy();
    expect(screen.getByText("Un experimento. La visión: evolucionar contigo.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tiny creature. Big decisions." }).getAttribute("lang")).toBe("en");
    expect(document.querySelectorAll("details, .story-navigation")).toHaveLength(0);
    expect(latest().presentation).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains the scrolled scene and character while switching language and theme", async () => {
    render(view());
    // Jev loads at the first particle change, so the test enters Bob before expecting the character.
    act(() => mocks.selectScene(1));
    const character = await screen.findByTestId("story-character");
    await act(async () => latest().onReady?.());
    act(() => mocks.selectScene(2));
    act(() => { preferencesStore.getState().setLanguage("en"); preferencesStore.getState().setThemePreference("dark"); });
    expect(document.querySelector(".story-page")?.getAttribute("data-story-selected")).toBe("titi");
    expect(screen.getByTestId("story-character")).toBe(character);
    expect(screen.getByText(/I'm Abdair Coca, a Computer Engineering student/)).toBeTruthy();
  });

  it("keeps load errors readable, rejects late readiness and retries only the character", async () => {
    render(view());
    // Jev loads at the first particle change, so the test enters Bob before expecting the character.
    act(() => mocks.selectScene(1));
    const character = await screen.findByTestId("story-character");
    const previous = latest();
    act(() => mocks.selectScene(4));
    act(() => previous.onError?.());
    await act(async () => previous.onReady?.());
    expect(document.querySelector(".story-page")?.getAttribute("data-story-status")).toBe("error");
    expect(screen.getAllByRole("region")).toHaveLength(5);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar carga" }));
    expect(screen.getByTestId("story-character")).not.toBe(character);
    await act(async () => { previous.onError?.(); previous.onReady?.(); });
    expect(document.querySelector(".story-page")?.getAttribute("data-story-status")).toBe("loading");
    await act(async () => latest().onReady?.());
    expect(document.querySelector(".story-page")?.getAttribute("data-story-status")).toBe("ready");
    expect(document.querySelector(".story-page")?.getAttribute("data-story-selected")).toBe("vision");
  });

  it("pauses offscreen and on a hidden tab and supplies the static fallback", async () => {
    const result = render(view());
    // Jev loads at the first particle change, so the test enters Bob before expecting the character.
    act(() => mocks.selectScene(1));
    await screen.findByTestId("story-character");
    await act(async () => latest().onReady?.());
    act(() => mocks.selectScene(4));
    mocks.inView = false; result.rerender(view());
    expect(latest().active).toBe(false);
    mocks.inView = true; mocks.reduced = true; result.rerender(view());
    expect(latest().active).toBe(true);
    expect(latest().staticPose).toBe(true);
    act(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(latest().active).toBe(false);
    expect(screen.getAllByRole("region")).toHaveLength(5);
  });

  it("reveals Jev through the scroll action while keeping a single character", async () => {
    render(view());
    // Jev loads at the first particle change, so the test enters Bob before expecting the character.
    act(() => mocks.selectScene(1));
    const character = await screen.findByTestId("story-character");
    await act(async () => latest().onReady?.());
    act(() => mocks.selectScene(2));
    expect(latest().active).toBe(false);
    act(() => mocks.selectScene(4));
    fireEvent.click(screen.getByRole("button", { name: /Revelar a Jev/ }));
    expect(mocks.reveal).toHaveBeenCalledOnce();
    expect(latest().active).toBe(true);
    expect(screen.getByTestId("story-character")).toBe(character);
  });

  it("offers recovery when binding never becomes ready and cancels its deadline on unmount", async () => {
    const result = render(view());
    // Jev loads at the first particle change, so the test enters Bob before expecting the character.
    act(() => mocks.selectScene(1));
    await screen.findByTestId("story-character");
    await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar carga" })).toBeTruthy(), { timeout: 1000 });
    expect(document.querySelector(".story-page")?.getAttribute("data-story-status")).toBe("error");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    const clear = vi.spyOn(window, "clearTimeout");
    result.unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});
