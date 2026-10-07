// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { DecisionScheduler } from "../src/creature/brain/decisionScheduler";
import { usePointerSensor } from "../src/creature/sensors/pointerSensor";
import { worldState } from "./helpers";

function pointerEvent(type: string, values: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true });
  for (const [key, value] of Object.entries({ pointerId: 1, pointerType: "mouse", clientX: 0, clientY: 0, ...values })) {
    Object.defineProperty(event, key, { configurable: true, value });
  }
  return event;
}

describe("usePointerSensor", () => {
  it("tracks pointer movement and click bursts without triggering Jev", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    vi.spyOn(performance, "now").mockReturnValue(5000);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(5000);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const stage = document.createElement("main");
    const creature = document.createElement("div");
    stage.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100,
      toJSON: () => ({}),
    }) as DOMRect;
    creature.getBoundingClientRect = () => ({
      x: 40, y: 40, left: 40, top: 40, right: 60, bottom: 60, width: 20, height: 20,
      toJSON: () => ({}),
    }) as DOMRect;
    const stageRef = { current: stage } as RefObject<HTMLElement | null>;
    const creatureRef = { current: creature } as RefObject<HTMLElement | null>;
    const { result, unmount } = renderHook(() => usePointerSensor(stageRef, creatureRef));
    const onDecision = vi.fn();
    const scheduler = new DecisionScheduler({
      getFrame: () => ({ state: worldState(), sensors: result.current.getSnapshot() }),
      onDecision,
      onStatus: vi.fn(),
    });
    scheduler.start();

    stage.dispatchEvent(pointerEvent("pointermove", { clientX: 80, clientY: 30 }));
    const moved = result.current.getSnapshot();
    expect(moved.cursorPosition).toEqual({ x: 0.8, y: 0.3 });
    expect(moved.eventVersions.clickBurst).toBe(0);
    expect(moved.eventVersions.returned).toBe(0);

    for (let pointerId = 1; pointerId <= 3; pointerId += 1) {
      stage.dispatchEvent(pointerEvent("pointerdown", { pointerId }));
      stage.dispatchEvent(pointerEvent("pointerup", { pointerId }));
    }
    const clicked = result.current.getSnapshot();
    expect(clicked.interactionBurst).toBe(true);
    expect(clicked.eventVersions.clickBurst).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDecision).not.toHaveBeenCalled();

    scheduler.stop();
    unmount();
  });

  it("detaches input listeners and pending paint while paused, then records one return", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(5000);
    const raf = vi.fn().mockReturnValue(7);
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const stage = document.createElement("main");
    const creature = document.createElement("div");
    stage.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);
    creature.getBoundingClientRect = () => new DOMRect(40, 40, 20, 20);
    const stageRef = { current: stage };
    const creatureRef = { current: creature };
    const { result, rerender, unmount } = renderHook(({ active }) => usePointerSensor(stageRef, creatureRef, active), { initialProps: { active: true } });
    stage.dispatchEvent(pointerEvent("pointermove", { clientX: 80, clientY: 30 }));
    stage.dispatchEvent(pointerEvent("pointerdown"));
    const interactions = result.current.getSnapshot().interactionCount;
    rerender({ active: false });
    expect(cancel).toHaveBeenCalledWith(7);
    stage.dispatchEvent(pointerEvent("pointermove", { clientX: 10, clientY: 10 }));
    stage.dispatchEvent(pointerEvent("pointerdown"));
    expect(result.current.getSnapshot()).toMatchObject({ pointerDown: false, mouseInsideStage: false, cursorPosition: { x: 0.8, y: 0.3 }, interactionCount: interactions });
    now.mockReturnValue(8000);
    rerender({ active: true });
    expect(result.current.getSnapshot()).toMatchObject({ returnedAfterAbsence: true, absenceSeconds: 3, sessionSeconds: 3, eventVersions: { returned: 1 } });
    stage.dispatchEvent(pointerEvent("pointermove", { clientX: 10, clientY: 10 }));
    expect(raf).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("does not turn internal route navigation into a return-from-absence event", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(5000);
    const stageRef = { current: document.createElement("main") };
    const creatureRef = { current: document.createElement("div") };
    const { result, rerender, unmount } = renderHook(({ active, homeSelected }) => usePointerSensor(stageRef, creatureRef, active, homeSelected), { initialProps: { active: true, homeSelected: true } });
    rerender({ active: false, homeSelected: false });
    now.mockReturnValue(15000);
    rerender({ active: true, homeSelected: true });
    expect(result.current.getSnapshot()).toMatchObject({ returnedAfterAbsence: false, absenceSeconds: 0, eventVersions: { returned: 0 } });
    unmount();
  });
});
