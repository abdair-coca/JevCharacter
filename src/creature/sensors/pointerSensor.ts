import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";

import { BRAIN_CONFIG } from "../brain/brainConfig";
import type { PointerKind, SensorSnapshot } from "../brain/brain.types";

type SensorState = {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  previousX: number;
  previousY: number;
  lastMoveAt: number;
  lastCountedMoveAt: number;
  speed: number;
  inside: boolean;
  pointerType: PointerKind;
  pointerDown: boolean;
  pointerDownAt: number;
  activePointers: Set<number>;
  lastInteractionAt: number;
  interactions: number;
  clicks: number[];
  sessionStart: number;
  absenceStartedAt: number | null;
  absenceSeconds: number;
  returnedUntil: number;
  clickBurstVersion: number;
  returnedVersion: number;
  lastBurstAt: number;
  animationFrame: number | null;
};

export type SensorController = {
  getSnapshot: () => SensorSnapshot;
  markContextInteraction: () => void;
};

const getPointerKind = (value: string): PointerKind => {
  if (value === "mouse" || value === "touch" || value === "pen") return value;
  return "unknown";
};

export function usePointerSensor(
  stageRef: RefObject<HTMLElement | null>,
  creatureRef: RefObject<HTMLElement | null>,
): SensorController {
  const stateRef = useRef<SensorState>({
    x: 0,
    y: 0,
    normalizedX: 0.5,
    normalizedY: 0.45,
    previousX: 0,
    previousY: 0,
    lastMoveAt: 0,
    lastCountedMoveAt: 0,
    speed: 0,
    inside: false,
    pointerType: "unknown",
    pointerDown: false,
    pointerDownAt: 0,
    activePointers: new Set(),
    lastInteractionAt: 0,
    interactions: 0,
    clicks: [],
    sessionStart: 0,
    absenceStartedAt: null,
    absenceSeconds: 0,
    returnedUntil: 0,
    clickBurstVersion: 0,
    returnedVersion: 0,
    lastBurstAt: 0,
    animationFrame: null,
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const state = stateRef.current;
    const mountedAt = performance.now();
    if (state.sessionStart === 0) state.sessionStart = mountedAt;
    if (state.lastInteractionAt === 0) state.lastInteractionAt = mountedAt;

    const paintPointer = () => {
      state.animationFrame = null;
      stage.style.setProperty("--pointer-x", `${state.normalizedX * 100}%`);
      stage.style.setProperty("--pointer-y", `${state.normalizedY * 100}%`);
    };

    const schedulePaint = () => {
      if (state.animationFrame === null) {
        state.animationFrame = window.requestAnimationFrame(paintPointer);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const now = performance.now();
      const rect = stage.getBoundingClientRect();
      const elapsed = state.lastMoveAt ? now - state.lastMoveAt : 16;
      const distance = Math.hypot(event.clientX - state.previousX, event.clientY - state.previousY);
      const instantaneous = Math.min(
        BRAIN_CONFIG.maxCursorSpeed,
        elapsed > 0 ? (distance / elapsed) * 1000 : 0,
      );

      state.speed = state.lastMoveAt ? state.speed * 0.68 + instantaneous * 0.32 : 0;
      state.previousX = event.clientX;
      state.previousY = event.clientY;
      state.x = event.clientX;
      state.y = event.clientY;
      state.normalizedX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      state.normalizedY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      state.lastMoveAt = now;
      state.inside = true;
      state.pointerType = getPointerKind(event.pointerType);

      if (distance > 4 && now - state.lastCountedMoveAt > 120) {
        state.lastCountedMoveAt = now;
        state.lastInteractionAt = now;
        state.interactions += 1;
      }

      schedulePaint();
    };

    const onPointerDown = (event: PointerEvent) => {
      const now = performance.now();
      if (state.activePointers.size === 0) state.pointerDownAt = now;
      state.activePointers.add(event.pointerId);
      state.pointerDown = true;
      state.pointerType = getPointerKind(event.pointerType);
      state.inside = true;
      state.lastInteractionAt = now;
      state.interactions += 1;
      state.clicks = [...state.clicks.filter((time) => now - time <= BRAIN_CONFIG.clickWindowMs), now];

      if (
        state.clicks.length >= BRAIN_CONFIG.clickBurstCount &&
        now - state.lastBurstAt > BRAIN_CONFIG.clickWindowMs
      ) {
        state.lastBurstAt = now;
        state.clickBurstVersion += 1;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      state.activePointers.delete(event.pointerId);
      state.pointerDown = state.activePointers.size > 0;
    };

    const startAbsence = () => {
      state.activePointers.clear();
      state.pointerDown = false;
      if (state.absenceStartedAt === null) state.absenceStartedAt = performance.now();
    };

    const finishAbsence = () => {
      if (state.absenceStartedAt === null) return;
      const now = performance.now();
      const duration = now - state.absenceStartedAt;
      state.absenceStartedAt = null;

      if (duration >= BRAIN_CONFIG.absenceThresholdMs) {
        state.absenceSeconds = duration / 1000;
        state.returnedUntil = now + BRAIN_CONFIG.returnedSignalMs;
        state.returnedVersion += 1;
        state.lastInteractionAt = now;
        state.interactions += 1;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") startAbsence();
      else finishAbsence();
    };

    const onPointerEnter = () => {
      state.inside = true;
    };

    const onPointerLeave = () => {
      state.inside = false;
    };

    stage.addEventListener("pointermove", onPointerMove, { passive: true });
    stage.addEventListener("pointerdown", onPointerDown, { passive: true });
    stage.addEventListener("pointerup", onPointerUp, { passive: true });
    stage.addEventListener("pointercancel", onPointerUp, { passive: true });
    stage.addEventListener("pointerenter", onPointerEnter, { passive: true });
    stage.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", startAbsence);
    window.addEventListener("focus", finishAbsence);

    return () => {
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
      stage.removeEventListener("pointerenter", onPointerEnter);
      stage.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", startAbsence);
      window.removeEventListener("focus", finishAbsence);
      if (state.animationFrame !== null) window.cancelAnimationFrame(state.animationFrame);
    };
  }, [creatureRef, stageRef]);

  const getSnapshot = useCallback((): SensorSnapshot => {
    const state = stateRef.current;
    const now = performance.now();
    const creatureRect = creatureRef.current?.getBoundingClientRect();
    const distance = creatureRect
      ? Math.hypot(
          state.x - (creatureRect.left + creatureRect.width / 2),
          state.y - (creatureRect.top + creatureRect.height / 2),
        )
      : 2000;
    const nearThreshold = creatureRect
      ? Math.max(175, Math.min(BRAIN_CONFIG.nearDistancePx, creatureRect.width * 0.52))
      : BRAIN_CONFIG.nearDistancePx;
    const clickTimes = state.clicks.filter((time) => now - time <= BRAIN_CONFIG.clickWindowMs);
    state.clicks = clickTimes;
    const speedDecay = Math.exp(-Math.max(0, now - state.lastMoveAt) / 260);
    const speed = state.speed * speedDecay;

    return {
      cursorPosition: { x: state.normalizedX, y: state.normalizedY },
      cursorDistance: Math.round(Math.min(2000, distance)),
      cursorSpeed: Math.round(speed < 4 ? 0 : speed),
      cursorNearCreature: distance <= nearThreshold,
      mouseInsideStage: state.inside,
      recentClicks: clickTimes.length,
      interactionBurst: clickTimes.length >= BRAIN_CONFIG.clickBurstCount,
      idleSeconds: Math.max(0, (now - state.lastInteractionAt) / 1000),
      returnedAfterAbsence: now <= state.returnedUntil,
      absenceSeconds: state.absenceSeconds,
      pointerType: state.pointerType,
      pointerDown: state.pointerDown,
      pointerHoldSeconds: state.pointerDown ? (now - state.pointerDownAt) / 1000 : 0,
      sessionSeconds: (now - state.sessionStart) / 1000,
      interactionCount: state.interactions,
      eventVersions: {
        clickBurst: state.clickBurstVersion,
        returned: state.returnedVersion,
      },
    };
  }, [creatureRef]);

  const markContextInteraction = useCallback(() => {
    const state = stateRef.current;
    state.lastInteractionAt = performance.now();
    state.interactions += 1;
  }, []);

  return useMemo(
    () => ({ getSnapshot, markContextInteraction }),
    [getSnapshot, markContextInteraction],
  );
}
