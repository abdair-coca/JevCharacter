// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DecisionScheduler } from "../src/creature/brain/decisionScheduler";
import type { BrainDecision, BrainStatus } from "../src/creature/brain/brain.types";
import { decision, jsonResponse, schedulerFrame } from "./helpers";

function createScheduler(initialFrame = schedulerFrame()) {
  const currentFrame = { value: initialFrame };
  const onDecision = vi.fn<(next: BrainDecision, latency: number, reason: string) => void>();
  const onStatus = vi.fn<(status: BrainStatus) => void>();
  const scheduler = new DecisionScheduler({
    getFrame: () => currentFrame.value,
    onDecision,
    onStatus,
  });
  return { scheduler, currentFrame, onDecision, onStatus };
}

describe("DecisionScheduler", () => {
  beforeEach(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { kind: "reaction", reaction: "FLOWER" },
    { kind: "answer", answer: "yes" },
    { kind: "talk", state: "talkb" },
    { kind: "morph", form: "triangle" },
  ] as const)("accepts a valid $kind action from Jev", async (action) => {
    const result = decision(action);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(result)));
    const { scheduler, onDecision } = createScheduler();

    scheduler.requestContextDecision();

    await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(1));
    expect(onDecision.mock.calls[0][0].action).toEqual(action);
    expect(onDecision.mock.calls[0][0].source).toBe("jev");
  });

  it("rejects invalid action states and falls back locally", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const invalid = decision({ kind: "talk", state: "not-a-talk-state" as never });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(invalid)));
    const { scheduler, onDecision, onStatus } = createScheduler();

    scheduler.requestContextDecision();

    await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(1));
    expect(onDecision.mock.calls[0][0].source).toBe("fallback");
    expect(onStatus).toHaveBeenLastCalledWith("observing");
  });

  it("enforces the per-minute request limit after six Jev calls", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(decision()));
    vi.stubGlobal("fetch", fetchMock);
    const { scheduler, currentFrame, onDecision } = createScheduler();

    for (let index = 0; index < 7; index += 1) {
      currentFrame.value = schedulerFrame(`context-${index}`);
      scheduler.requestContextDecision();
      await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(index + 1));
    }

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(onDecision.mock.calls[6][0].source).toBe("fallback");
  });

  it("aborts a stale decision when new context replaces it", async () => {
    let firstSignal: AbortSignal | undefined;
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
        firstSignal = options.signal as AbortSignal;
        firstSignal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }))
      .mockResolvedValueOnce(jsonResponse(decision({ kind: "talk", state: "Talk" })));
    vi.stubGlobal("fetch", fetchMock);
    const { scheduler, currentFrame, onDecision } = createScheduler();

    scheduler.requestContextDecision();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    currentFrame.value = schedulerFrame("nuevo contexto");
    scheduler.requestContextDecision();

    await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(1));
    expect(firstSignal?.aborted).toBe(true);
    expect(onDecision.mock.calls[0][0].action).toEqual({ kind: "talk", state: "Talk" });
  });

  it("uses a local fallback after endpoint errors", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "unavailable" }, 503)));
    const { scheduler, onDecision } = createScheduler();

    scheduler.requestContextDecision();

    await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(1));
    expect(onDecision.mock.calls[0][0].source).toBe("fallback");
  });

});
