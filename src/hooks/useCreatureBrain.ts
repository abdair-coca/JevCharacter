import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import type { CharacterController, CharacterState } from "../character/useCharacterController";
import { BRAIN_CONFIG } from "../creature/brain/brainConfig";
import { DecisionScheduler } from "../creature/brain/decisionScheduler";
import type {
  BinaryAnswer,
  BrainDecision,
  BrainStatus,
  CreatureWorldState,
  DecisionAction,
  MorphForm,
  Personality,
  Reaction,
  ReactionHistoryEntry,
  SchedulerFrame,
  TalkState,
} from "../creature/brain/brain.types";
import { evolvePersonality } from "../creature/personality/personality";
import {
  loadPersonality,
  savePersonality,
} from "../creature/personality/personalityStorage";
import { MORPH_FORMS, mentionedMorphForms, requestedMorphForm } from "../creature/brain/morphIntent";
import type { SpeechLanguage } from "../creature/brain/speechProtocol";
import { useSpeechSession, type SpeechCaption, type SpeechNotice } from "./useSpeechSession";
import { executeDecisionAction } from "../creature/rive/riveReactionAdapter";
import type { SensorController } from "../creature/sensors/pointerSensor";

const CONTEXT_KEY = "jevling.context";

const INITIAL_DECISION: BrainDecision = {
  action: { kind: "reaction", reaction: "BASE" },
  actionConfidence: 0.76,
  reaction: "BASE",
  reactionConfidence: 0.76,
  probabilities: {
    BASE: 0.76,
    HELLO: 0.1,
    GHOST: 0.06,
    FLOWER: 0.08,
    CLOUD: 0,
    YES: 0,
    NO: 0,
    STAR: 0,
    SQUARE: 0,
    TRIANGLE: 0,
  },
  intensity: 0.25,
  wantsAttention: 0.48,
  source: "fallback",
};

type CreatureBrain = {
  decision: BrainDecision;
  status: BrainStatus;
  personality: Personality;
  userContext: string;
  speechCaption: SpeechCaption | null;
  speechNotice: SpeechNotice;
  decisionInterrupted: boolean;
  onSpeechCaptionRevealed: (generation: number) => void;
  history: ReactionHistoryEntry[];
  apiLatencyMs: number;
  submitContext: (context: string) => void;
  clearContext: () => void;
  forceState: (state: CharacterState) => void;
};

export function useCreatureBrain(
  sensors: SensorController,
  characterRef: RefObject<CharacterController | null>,
  { active = true, language = "es" }: { active?: boolean; language?: SpeechLanguage } = {},
): CreatureBrain {
  const [decision, setDecision] = useState(INITIAL_DECISION);
  const [status, setStatus] = useState<BrainStatus>("observing");
  const [personality, setPersonality] = useState(loadPersonality);
  const [userContext, setUserContext] = useState("");
  const speech = useSpeechSession(characterRef, language, active);
  const { start: startSpeech, cancel: cancelSpeech } = speech;
  const [decisionInterrupted, setDecisionInterrupted] = useState(false);
  const activeRef = useRef(active);
  const [history, setHistory] = useState<ReactionHistoryEntry[]>([]);
  const [apiLatencyMs, setApiLatencyMs] = useState(0);
  const schedulerRef = useRef<DecisionScheduler | null>(null);
  const personalityRef = useRef(personality);
  const contextRef = useRef(userContext);
  const decisionRef = useRef(decision);
  const lastMorphFormRef = useRef<MorphForm | null>(null);
  const lastReactionAtRef = useRef(0);
  const contextEventRef = useRef(0);
  const thinkingShownRef = useRef(false);
  const consumedEventRef = useRef({ clickBurst: 0, returned: 0, context: 0 });

  useLayoutEffect(() => {
    activeRef.current = active;
    if (active) schedulerRef.current?.start();
    else {
      if (thinkingShownRef.current) setDecisionInterrupted(true);
      schedulerRef.current?.stop();
      thinkingShownRef.current = false;
      setStatus("observing");
      characterRef.current?.stop();
    }
  }, [active, characterRef]);

  useEffect(() => {
    try {
      window.localStorage.removeItem(CONTEXT_KEY);
    } catch {
      // Storage may be unavailable; new context is never written here.
    }
  }, []);

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

    const updateStatus = (nextStatus: BrainStatus) => {
      if (!activeRef.current) return;
      setStatus(nextStatus);
      if (nextStatus === "deciding" && !thinkingShownRef.current) {
        thinkingShownRef.current = true;
        void characterRef.current?.think();
      }
    };

    const scheduler = new DecisionScheduler({
      getFrame,
      onStatus: updateStatus,
      onDecision: (nextDecision, latencyMs, reason) => {
        if (!activeRef.current || document.visibilityState !== "visible") return;
        const previousDecision = decisionRef.current;
        const reactionChanged = previousDecision.reaction !== nextDecision.reaction;
        const actionChanged = JSON.stringify(previousDecision.action) !== JSON.stringify(nextDecision.action);
        const wasThinking = thinkingShownRef.current;
        let action: DecisionAction = reason === "context"
          ? nextDecision.action
          : { kind: "reaction", reaction: nextDecision.reaction };
        if (action.kind === "morph") {
          const namedForm = requestedMorphForm(contextRef.current);
          let form = namedForm ?? action.form;
          if (mentionedMorphForms(contextRef.current).length === 0 && form === lastMorphFormRef.current) {
            const alternatives = MORPH_FORMS.filter((candidate) => candidate !== form);
            form = alternatives[Math.floor(Math.random() * alternatives.length)];
          }
          action = { kind: "morph", form };
          lastMorphFormRef.current = form;
        }
        const actionConfidence = reason === "context"
          ? nextDecision.actionConfidence
          : nextDecision.reactionConfidence;
        const decisionToApply = { ...nextDecision, action, actionConfidence };

        thinkingShownRef.current = false;
        decisionRef.current = decisionToApply;
        if (reactionChanged) lastReactionAtRef.current = performance.now();
        setDecision(decisionToApply);
        setApiLatencyMs(Math.round(latencyMs));
        setHistory((current) => [
          ...current,
          {
            reaction: decisionToApply.reaction,
            confidence: decisionToApply.reactionConfidence,
            timestamp: Date.now(),
          },
        ].slice(-5));

        if (reason === "context" && decisionToApply.action.kind === "talk" && contextRef.current.trim()) {
          startSpeech(contextRef.current, decisionToApply.action.state);
        } else if (reason === "context" && decisionToApply.action.kind === "talk") {
          void characterRef.current?.idle();
        } else if (reason === "context" || reactionChanged || actionChanged || wasThinking) {
          cancelSpeech();
          void executeDecisionAction(characterRef.current, decisionToApply);
        }
      },
    });
    schedulerRef.current = scheduler;
    if (activeRef.current) scheduler.start();
    else scheduler.stop();

    return () => {
      scheduler.stop();
      schedulerRef.current = null;
    };
  }, [cancelSpeech, characterRef, getFrame, startSpeech]);

  useEffect(() => {
    if (!active) return;
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
  }, [active, sensors]);

  const submitContext = (context: string) => {
    if (!activeRef.current || document.visibilityState !== "visible") return;
    const safeContext = context.trim().slice(0, BRAIN_CONFIG.contextMaxLength);
    if (!safeContext) return;
    cancelSpeech();
    setDecisionInterrupted(false);
    if (!thinkingShownRef.current) {
      thinkingShownRef.current = true;
      void characterRef.current?.think();
    }
    contextRef.current = safeContext;
    setUserContext(safeContext);
    contextEventRef.current += 1;
    sensors.markContextInteraction();
    schedulerRef.current?.requestContextDecision();
  };

  const clearContext = useCallback(() => {
    if (!activeRef.current || document.visibilityState !== "visible") return;
    cancelSpeech(true);
    schedulerRef.current?.clearConversation();
    thinkingShownRef.current = false;
    setDecisionInterrupted(false);
    contextRef.current = "";
    setUserContext("");
    sensors.markContextInteraction();
    schedulerRef.current?.requestContextDecision();
  }, [cancelSpeech, sensors]);

  const forceState = (state: CharacterState) => {
    if (!activeRef.current || document.visibilityState !== "visible") return;
    schedulerRef.current?.cancelPending();
    setStatus("observing");
    thinkingShownRef.current = false;
    cancelSpeech();
    setDecisionInterrupted(false);
    if (state === "Cloud") {
      void characterRef.current?.cloud();
      return;
    }
    if (state === "Talk" || state === "talkb" || state === "talkc" || state === "talkbc") {
      const action: DecisionAction = { kind: "talk", state: state as TalkState };
      const next = { ...decisionRef.current, action, actionConfidence: 1 };
      decisionRef.current = next;
      setDecision(next);
      void characterRef.current?.talk(state);
      return;
    }
    if (state === "yes" || state === "no") {
      const action: DecisionAction = { kind: "answer", answer: state as BinaryAnswer };
      const next = { ...decisionRef.current, action, actionConfidence: 1 };
      decisionRef.current = next;
      setDecision(next);
      void characterRef.current?.answer(state);
      return;
    }

    const reactionByState: Partial<Record<CharacterState, Reaction>> = {
      Base: "BASE",
      Hello: "HELLO",
      Ghost: "GHOST",
      Flower: "FLOWER",
    };
    const reaction = reactionByState[state];
    if (!reaction) return;
    const next = {
      ...decisionRef.current,
      action: { kind: "reaction", reaction } as const,
      actionConfidence: 1,
      reaction,
      reactionConfidence: 1,
    };
    decisionRef.current = next;
    lastReactionAtRef.current = performance.now();
    setDecision(next);
    void executeDecisionAction(characterRef.current, next);
  };

  return {
    decision,
    status: status === "deciding" || speech.status === "waiting" ? "deciding" : "observing",
    personality,
    userContext,
    speechCaption: speech.caption,
    speechNotice: speech.notice,
    decisionInterrupted,
    onSpeechCaptionRevealed: speech.onCaptionRevealed,
    history,
    apiLatencyMs,
    submitContext,
    clearContext,
    forceState,
  };
}
