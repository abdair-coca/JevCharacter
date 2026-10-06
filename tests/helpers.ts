import type {
  BrainDecision,
  CreatureWorldState,
  DecisionAction,
  SchedulerFrame,
  SensorSnapshot,
} from "../src/creature/brain/brain.types";

export function sensorSnapshot(overrides: Partial<SensorSnapshot> = {}): SensorSnapshot {
  const base: SensorSnapshot = {
    cursorPosition: { x: 0.5, y: 0.5 },
    cursorDistance: 500,
    cursorSpeed: 0,
    cursorNearCreature: false,
    mouseInsideStage: false,
    recentClicks: 0,
    interactionBurst: false,
    idleSeconds: 0,
    returnedAfterAbsence: false,
    absenceSeconds: 0,
    pointerType: "unknown",
    pointerDown: false,
    pointerHoldSeconds: 0,
    sessionSeconds: 1,
    interactionCount: 0,
    eventVersions: { clickBurst: 0, returned: 0 },
  };
  return {
    ...base,
    ...overrides,
    cursorPosition: { ...base.cursorPosition, ...overrides.cursorPosition },
    eventVersions: { ...base.eventVersions, ...overrides.eventVersions },
  };
}

export function worldState(userContext = "hola"): CreatureWorldState {
  return {
    userContext,
    interaction: { idleSeconds: 0, returnedAfterAbsence: false, absenceSeconds: 0 },
    creature: {
      previousReaction: "BASE",
      secondsSinceReaction: 10,
      personality: { energy: 50, trust: 50, curiosity: 50 },
    },
    session: { secondsAlive: 1 },
  };
}

export function schedulerFrame(userContext = "hola"): SchedulerFrame {
  return { state: worldState(userContext), sensors: sensorSnapshot() };
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function decision(
  action: DecisionAction = { kind: "reaction", reaction: "BASE" },
): BrainDecision {
  const reaction = action.kind === "reaction" ? action.reaction : "BASE";
  return {
    action,
    actionConfidence: 0.9,
    reaction,
    reactionConfidence: 0.9,
    probabilities: { BASE: 0.8, HELLO: 0.1, GHOST: 0.05, FLOWER: 0.05 },
    intensity: 0.4,
    wantsAttention: 0.3,
    source: "jev",
  };
}
