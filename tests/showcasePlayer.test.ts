import { createActor } from "xstate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTERS, chapterAt, type DemoAction, type ShowcaseTimings } from "../src/features/showcase/catalog";
import { showcaseMachine } from "../src/features/showcase/player";

const timings: ShowcaseTimings = { prepare: 10, ready: 100, observe: 20, reaction: 30, think: 15, answer: 25, talk: 35, morph: 60 };
const actors: ReturnType<typeof createActor<typeof showcaseMachine>>[] = [];
function player(reduced = false) {
  const execute = vi.fn<(action: DemoAction) => void>();
  const reset = vi.fn();
  const actor = createActor(showcaseMachine, { input: { timings, reduced, port: { execute, reset } } }).start();
  actors.push(actor);
  return { actor, execute, reset };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { actors.splice(0).forEach(actor => actor.stop()); vi.useRealTimers(); });

describe("showcase script", () => {
  it("has eight unique bilingual chapters and valid fixed steps", () => {
    expect(new Set(CHAPTERS.map(chapter => chapter.id)).size).toBe(8);
    for (const chapter of CHAPTERS) {
      for (const language of ["es", "en"] as const) {
        expect(chapter.title[language]).toBeTruthy();
        expect(chapter.explanation[language]).toBeTruthy();
        expect(chapter.steps.every(step => Boolean(step.caption[language]))).toBe(true);
      }
      expect(chapter.steps.every(step => timings[step.duration] > 0)).toBe(true);
    }
    expect(chapterAt(5).steps.map(step => step.action)).toEqual([{ kind: "morph", form: "star" }, { kind: "morph", form: "square" }, { kind: "morph", form: "triangle" }]);
  });
});

describe("deterministic playback", () => {
  it("does not dispatch before binding readiness and preparation", () => {
    const { actor, execute } = player();
    vi.advanceTimersByTime(50);
    expect(execute).not.toHaveBeenCalled();
    actor.send({ type: "READY" });
    expect(actor.getSnapshot().matches("prepare")).toBe(true);
    vi.advanceTimersByTime(9);
    expect(execute).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(execute).toHaveBeenCalledWith(CHAPTERS[0].steps[0].action);
  });
  it.each(CHAPTERS.map((chapter, index) => [chapter.id, index] as const))("repeats the identical ordered actions and completion for %s", (_id, index) => {
    const { actor, execute } = player();
    actor.send({ type: "SELECT", chapter: index });
    actor.send({ type: "READY" });
    const total = timings.prepare + chapterAt(index).steps.reduce((sum, step) => sum + timings[step.duration], 0);
    vi.advanceTimersByTime(total);
    const first = execute.mock.calls.map(([action]) => action);
    expect(first).toEqual(chapterAt(index).steps.map(step => step.action));
    expect(actor.getSnapshot().matches("complete")).toBe(true);
    execute.mockClear();
    actor.send({ type: "REPLAY" });
    vi.advanceTimersByTime(total);
    expect(execute.mock.calls.map(([action]) => action)).toEqual(first);
    expect(actor.getSnapshot().matches("complete")).toBe(true);
  });
  it("cancels earlier chapter timers during rapid selection/replay", () => {
    const { actor, execute } = player();
    actor.send({ type: "READY" });
    vi.advanceTimersByTime(10);
    actor.send({ type: "SELECT", chapter: 5 });
    vi.advanceTimersByTime(10);
    actor.send({ type: "SELECT", chapter: 3 });
    actor.send({ type: "REPLAY" });
    execute.mockClear();
    vi.advanceTimersByTime(500);
    expect(execute.mock.calls.map(([action]) => action)).toEqual(chapterAt(3).steps.map(step => step.action));
    expect(actor.getSnapshot().context.chapter).toBe(3);
  });
  it("suspends without a stale queue and resumes that chapter from step zero", () => {
    const { actor, execute, reset } = player();
    actor.send({ type: "SELECT", chapter: 1 });
    actor.send({ type: "READY" });
    vi.advanceTimersByTime(40);
    expect(actor.getSnapshot().context.step).toBe(1);
    actor.send({ type: "SUSPEND" });
    execute.mockClear();
    vi.advanceTimersByTime(1000);
    expect(execute).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
    actor.send({ type: "RESUME" });
    expect(actor.getSnapshot().context.chapter).toBe(1);
    expect(actor.getSnapshot().context.step).toBe(0);
    vi.advanceTimersByTime(10);
    expect(execute).toHaveBeenCalledExactlyOnceWith(chapterAt(1).steps[0].action);
  });
  it("keeps hidden readiness suspended and has a textual reduced-motion mode", () => {
    const { actor, execute } = player(true);
    actor.send({ type: "SUSPEND" });
    actor.send({ type: "READY" });
    vi.advanceTimersByTime(500);
    expect(actor.getSnapshot().matches("interrupted")).toBe(true);
    actor.send({ type: "RESUME" });
    expect(actor.getSnapshot().matches("static")).toBe(true);
    actor.send({ type: "SELECT", chapter: 6 });
    actor.send({ type: "REPLAY" });
    vi.advanceTimersByTime(500);
    expect(execute).not.toHaveBeenCalled();
    actor.send({ type: "MODE", reduced: false });
    vi.advanceTimersByTime(10);
    expect(execute).toHaveBeenCalledWith(chapterAt(6).steps[0].action);
  });
  it("reports load timeout, preserves errors through navigation/visibility and retries explicitly", () => {
    const { actor, execute } = player();
    vi.advanceTimersByTime(100);
    expect(actor.getSnapshot().matches("error")).toBe(true);
    actor.send({ type: "READY" });
    expect(actor.getSnapshot().matches("error")).toBe(true);
    actor.send({ type: "SELECT", chapter: 4 });
    actor.send({ type: "REPLAY" });
    actor.send({ type: "SUSPEND" });
    actor.send({ type: "RESUME" });
    expect(actor.getSnapshot().matches("error")).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches("loading")).toBe(true);
    actor.send({ type: "READY" });
    vi.advanceTimersByTime(10);
    expect(execute).toHaveBeenCalledWith(chapterAt(4).steps[0].action);
  });
  it("ignores invalid selection and clears delayed work on teardown", () => {
    const { actor, execute } = player();
    actor.send({ type: "SELECT", chapter: Number.NaN });
    expect(actor.getSnapshot().context.chapter).toBe(0);
    actor.send({ type: "READY" });
    actor.stop();
    vi.advanceTimersByTime(1000);
    expect(execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
