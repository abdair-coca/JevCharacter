import { assign, setup } from "xstate";
import { chapterAt, CHAPTERS, type DemoAction, type ShowcaseTimings } from "./catalog";

export type ShowcasePort = { execute: (action: DemoAction) => void; reset: () => void };
type Input = { timings: ShowcaseTimings; port: ShowcasePort; reduced: boolean };
type Context = Input & { chapter: number; step: number; ready: boolean; visible: boolean };
type Event = { type: "SELECT"; chapter: number } | { type: "MODE"; reduced: boolean }
  | { type: "READY" | "REPLAY" | "SUSPEND" | "RESUME" | "ERROR" | "RETRY" };

export const showcaseMachine = setup({
  types: { context: {} as Context, input: {} as Input, events: {} as Event },
  delays: {
    readyDeadline: ({ context }) => context.timings.ready,
    prepareDelay: ({ context }) => context.timings.prepare,
    stepDelay: ({ context }) => context.timings[chapterAt(context.chapter).steps[context.step].duration],
  },
  actions: {
    reset: ({ context }) => context.port.reset(),
    perform: ({ context }) => context.port.execute(chapterAt(context.chapter).steps[context.step].action),
    restart: assign({ step: 0 }),
    advance: assign({ step: ({ context }) => context.step + 1 }),
    select: assign({ chapter: ({ event, context }) => event.type === "SELECT" ? Math.max(0, Math.min(CHAPTERS.length - 1, Math.trunc(event.chapter))) : context.chapter, step: 0 }),
  },
}).createMachine({
  id: "showcase",
  context: ({ input }) => ({ ...input, chapter: 0, step: 0, ready: false, visible: true }),
  initial: "loading",
  on: {
    SELECT: { guard: ({ context, event }) => Number.isFinite(event.chapter) && Math.trunc(event.chapter) !== context.chapter, actions: "select", target: ".prepare", reenter: true },
    REPLAY: { actions: "restart", target: ".prepare", reenter: true },
    READY: { guard: ({ context }) => !context.ready, actions: assign({ ready: true }), target: ".prepare" },
    SUSPEND: { actions: assign({ visible: false }), target: ".interrupted" },
    RESUME: { guard: ({ context }) => !context.visible, actions: [assign({ visible: true }), "restart"], target: ".prepare" },
    MODE: { guard: ({ context, event }) => context.reduced !== event.reduced, actions: [assign({ reduced: ({ event }) => event.type === "MODE" && event.reduced }), "restart"], target: ".prepare" },
    ERROR: { target: ".error" },
    RETRY: { actions: [assign({ ready: false }), "restart"], target: ".prepare" },
  },
  states: {
    loading: { after: { readyDeadline: "error" } },
    prepare: {
      entry: "reset",
      always: [
        { guard: ({ context }) => !context.visible, target: "interrupted" },
        { guard: ({ context }) => !context.ready, target: "loading" },
        { guard: ({ context }) => context.reduced, target: "static" },
      ],
      after: { prepareDelay: "playing" },
    },
    playing: {
      entry: "perform",
      exit: "reset",
      after: { stepDelay: [
        { guard: ({ context }) => context.step + 1 < chapterAt(context.chapter).steps.length, actions: "advance", target: "playing", reenter: true },
        { target: "complete" },
      ] },
    },
    complete: { entry: "reset" },
    interrupted: { entry: "reset" },
    static: { entry: "reset" },
    error: { entry: "reset", on: {
      READY: {},
      SELECT: { guard: ({ event }) => Number.isFinite(event.chapter), actions: "select" },
      REPLAY: {},
      MODE: { actions: assign({ reduced: ({ event }) => event.reduced }) },
      SUSPEND: { actions: assign({ visible: false }) },
      RESUME: { actions: assign({ visible: true }) },
    } },
  },
});
