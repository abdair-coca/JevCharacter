import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { CharacterController } from "../character/useCharacterController";
import { BRAIN_CONFIG } from "../creature/brain/brainConfig";
import { DecisionScheduler } from "../creature/brain/decisionScheduler";
import type {
  BrainDecision,
  BrainStatus,
  CreatureWorldState,
  Personality,
  Reaction,
  ReactionHistoryEntry,
  SchedulerFrame,
} from "../creature/brain/brain.types";
import { evolvePersonality } from "../creature/personality/personality";
import {
  loadPersonality,
  savePersonality,
} from "../creature/personality/personalityStorage";
import {
  playRiveReaction,
  reactWithRive,
  showRiveObserving,
} from "../creature/rive/riveReactionAdapter";
import type { SensorController } from "../creature/sensors/pointerSensor";
import { readStorage, writeStorage } from "../lib/storage";

const CONTEXT_KEY = "jevling.context";

const INITIAL_DECISION: BrainDecision = {
  reaction: "BASE",
  reactionConfidence: 0.76,
  probabilities: { BASE: 0.76, HELLO: 0.1, GHOST: 0.06, FLOWER: 0.08 },
  intensity: 0.25,
  wantsAttention: 0.48,
  source: "fallback",
};

const isStoredContext = (value: unknown): value is { version: 1; value: string } => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; value?: unknown };
  return (
    candidate.version === 1 &&
    typeof candidate.value === "string" &&
    candidate.value.length <= BRAIN_CONFIG.contextMaxLength
  );
};

const loadContext = () =>
  readStorage(CONTEXT_KEY, { version: 1 as const, value: "" }, isStoredContext).value;

type CreatureBrain = {
  decision: BrainDecision;
  status: BrainStatus;
  personality: Personality;
  userContext: string;
  history: ReactionHistoryEntry[];
  apiLatencyMs: number;
  submitContext: (context: string) => void;
  clearContext: () => void;
  forceReaction: (reaction: Reaction) => void;
};

export function useCreatureBrain(
  sensors: SensorController,
  characterRef: RefObject<CharacterController | null>,
): CreatureBrain {
  const [decision, setDecision] = useState(INITIAL_DECISION);
  const [status, setStatus] = useState<BrainStatus>("observing");
  const [personality, setPersonality] = useState(loadPersonality);
  const [userContext, setUserContext] = useState(loadContext);
  const [history, setHistory] = useState<ReactionHistoryEntry[]>([]);
  const [apiLatencyMs, setApiLatencyMs] = useState(0);
  const schedulerRef = useRef<DecisionScheduler | null>(null);
  const personalityRef = useRef(personality);
  const contextRef = useRef(userContext);
  const decisionRef = useRef(decision);
  const lastReactionAtRef = useRef(0);
  const contextEventRef = useRef(0);
  const consumedEventRef = useRef({ clickBurst: 0, returned: 0, context: 0 });

  const getFrame = useCallback((): SchedulerFrame => {
    const snapshot = sensors.getSnapshot();
    const state: CreatureWorldState = {
      userContext: contextRef.current,
      interaction: {
        cursorDistance: snapshot.cursorDistance,
        cursorSpeed: snapshot.cursorSpeed,
        cursorNearCreature: snapshot.cursorNearCreature,
        mouseInsideStage: snapshot.mouseInsideStage,
        recentClicks: snapshot.recentClicks,
        interactionBurst: snapshot.interactionBurst,
        idleSeconds: Number(snapshot.idleSeconds.toFixed(1)),
        returnedAfterAbsence: snapshot.returnedAfterAbsence,
        absenceSeconds: Number(snapshot.absenceSeconds.toFixed(1)),
        pointerType: snapshot.pointerType,
        pointerHoldSeconds: Number(snapshot.pointerHoldSeconds.toFixed(1)),
      },
      creature: {
        previousReaction: decisionRef.current.reaction,
        secondsSinceReaction: (performance.now() - lastReactionAtRef.current) / 1000,
        personality: personalityRef.current,
      },
      session: {
        secondsAlive: Number(snapshot.sessionSeconds.toFixed(1)),
        interactions: snapshot.interactionCount,
      },
    };
    return { state, sensors: snapshot };
  }, [sensors]);

  useEffect(() => {
    lastReactionAtRef.current = performance.now() - BRAIN_CONFIG.strongReactionCooldownMs;
    const scheduler = new DecisionScheduler({
      getFrame,
      onStatus: setStatus,
      onObserving: () => {
        void showRiveObserving(characterRef.current);
      },
      onDecision: (nextDecision, latencyMs) => {
        decisionRef.current = nextDecision;
        lastReactionAtRef.current = performance.now();
        setDecision(nextDecision);
        setApiLatencyMs(Math.round(latencyMs));
        setHistory((current) => [
          ...current,
          {
            reaction: nextDecision.reaction,
            confidence: nextDecision.reactionConfidence,
            timestamp: Date.now(),
          },
        ].slice(-5));
        void reactWithRive(characterRef.current, nextDecision);
      },
    });
    schedulerRef.current = scheduler;
    scheduler.start();

    return () => {
      scheduler.stop();
      schedulerRef.current = null;
    };
  }, [characterRef, getFrame]);

  useEffect(() => {
    let ticks = 0;
    const timer = window.setInterval(() => {
      const snapshot = sensors.getSnapshot();
      const consumed = consumedEventRef.current;
      const events = {
        clickBurst: snapshot.eventVersions.clickBurst !== consumed.clickBurst,
        returned: snapshot.eventVersions.returned !== consumed.returned,
        contextReceived: contextEventRef.current !== consumed.context,
      };
      consumed.clickBurst = snapshot.eventVersions.clickBurst;
      consumed.returned = snapshot.eventVersions.returned;
      consumed.context = contextEventRef.current;

      const next = evolvePersonality(personalityRef.current, snapshot, events, 1);
      personalityRef.current = next;
      setPersonality(next);
      ticks += 1;
      if (ticks % 5 === 0) savePersonality(next);
    }, 1000);

    return () => {
      window.clearInterval(timer);
      savePersonality(personalityRef.current);
    };
  }, [sensors]);

  const submitContext = useCallback(
    (context: string) => {
      const safeContext = context.slice(0, BRAIN_CONFIG.contextMaxLength);
      contextRef.current = safeContext;
      setUserContext(safeContext);
      writeStorage(CONTEXT_KEY, { version: 1, value: safeContext });
      contextEventRef.current += 1;
      sensors.markContextInteraction();
      schedulerRef.current?.requestContextDecision();
    },
    [sensors],
  );

  const clearContext = useCallback(() => {
    contextRef.current = "";
    setUserContext("");
    writeStorage(CONTEXT_KEY, { version: 1, value: "" });
    sensors.markContextInteraction();
    schedulerRef.current?.requestContextDecision();
  }, [sensors]);

  const forceReaction = useCallback(
    (reaction: Reaction) => {
      const next = {
        ...decisionRef.current,
        reaction,
        reactionConfidence: 1,
      };
      decisionRef.current = next;
      lastReactionAtRef.current = performance.now();
      setDecision(next);
      void playRiveReaction(characterRef.current, reaction);
    },
    [characterRef],
  );

  return {
    decision,
    status,
    personality,
    userContext,
    history,
    apiLatencyMs,
    submitContext,
    clearContext,
    forceReaction,
  };
}
