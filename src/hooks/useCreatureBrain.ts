import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { CharacterController, CharacterState } from "../character/useCharacterController";
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
  reactWithRive,
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
  forceState: (state: CharacterState) => void;
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
  const statusRef = useRef<BrainStatus>("observing");
  const thinkingTimerRef = useRef<number | null>(null);
  const thinkingShownRef = useRef(false);
  const pendingMessageRef = useRef(false);
  const consumedEventRef = useRef({ clickBurst: 0, returned: 0, context: 0 });

  const getFrame = useCallback((): SchedulerFrame => {
    const snapshot = sensors.getSnapshot();
    const state: CreatureWorldState = {
      userContext: contextRef.current,
      interaction: {
        idleSeconds: Number(snapshot.idleSeconds.toFixed(1)),
        returnedAfterAbsence: snapshot.returnedAfterAbsence,
        absenceSeconds: Number(snapshot.absenceSeconds.toFixed(1)),
      },
      creature: {
        previousReaction: decisionRef.current.reaction,
        secondsSinceReaction: (performance.now() - lastReactionAtRef.current) / 1000,
        personality: personalityRef.current,
      },
      session: {
        secondsAlive: Number(snapshot.sessionSeconds.toFixed(1)),
      },
    };
    return { state, sensors: snapshot };
  }, [sensors]);

  useEffect(() => {
    lastReactionAtRef.current = performance.now() - BRAIN_CONFIG.strongReactionCooldownMs;

    const clearThinkingTimer = () => {
      if (thinkingTimerRef.current === null) return;
      window.clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    };

    const updateStatus = (nextStatus: BrainStatus) => {
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      clearThinkingTimer();

      if (nextStatus === "deciding") {
        thinkingTimerRef.current = window.setTimeout(() => {
          thinkingTimerRef.current = null;
          if (statusRef.current === "deciding") {
            thinkingShownRef.current = true;
            void characterRef.current?.cloud();
          }
        }, BRAIN_CONFIG.thinkingDelayMs);
      }
    };

    const scheduler = new DecisionScheduler({
      getFrame,
      onStatus: updateStatus,
      onDecision: (nextDecision, latencyMs, reason) => {
        const previousDecision = decisionRef.current;
        const reactionChanged = previousDecision.reaction !== nextDecision.reaction;
        const wasThinking = thinkingShownRef.current;
        const contextMessage = reason === "context" && pendingMessageRef.current;
        const shouldTalk =
          contextMessage &&
          nextDecision.source === "jev" &&
          nextDecision.reaction === "BASE" &&
          nextDecision.wantsAttention >= BRAIN_CONFIG.talkAttentionThreshold;

        clearThinkingTimer();
        thinkingShownRef.current = false;
        if (reason === "context") pendingMessageRef.current = false;
        decisionRef.current = nextDecision;
        if (reactionChanged) lastReactionAtRef.current = performance.now();
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

        if (shouldTalk) {
          void characterRef.current?.talk();
        } else if (reactionChanged || wasThinking) {
          void reactWithRive(characterRef.current, nextDecision);
        }
      },
    });
    schedulerRef.current = scheduler;
    scheduler.start();

    return () => {
      clearThinkingTimer();
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
      pendingMessageRef.current = true;
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
    pendingMessageRef.current = false;
    contextRef.current = "";
    setUserContext("");
    writeStorage(CONTEXT_KEY, { version: 1, value: "" });
    sensors.markContextInteraction();
    schedulerRef.current?.requestContextDecision();
  }, [sensors]);

  const forceState = useCallback(
    (state: CharacterState) => {
      if (state === "Cloud") {
        void characterRef.current?.cloud();
        return;
      }
      if (state === "Talk") {
        void characterRef.current?.talk();
        return;
      }

      const reactionByState: Record<Exclude<CharacterState, "Cloud" | "Talk">, Reaction> = {
        Base: "BASE",
        Hello: "HELLO",
        Ghost: "GHOST",
        Flower: "FLOWER",
      };
      const reaction = reactionByState[state];
      const next = {
        ...decisionRef.current,
        reaction,
        reactionConfidence: 1,
      };
      decisionRef.current = next;
      lastReactionAtRef.current = performance.now();
      setDecision(next);
      void reactWithRive(characterRef.current, next);
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
    forceState,
  };
}
