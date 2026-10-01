import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";

import { BRAIN_CONFIG } from "../src/creature/brain/brainConfig";
import { requestedMorphForm } from "../src/creature/brain/morphIntent";
import {
  REACTIONS,
  type DecisionAction,
  type BrainDecision,
  type MorphForm,
  type CreatureWorldState,
  type Personality,
  type Reaction,
  type TalkState,
} from "../src/creature/brain/brain.types";

const rateBuckets = new Map<string, { startedAt: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const SERVER_RATE_LIMIT = 24;

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

const isFiniteInRange = (value: unknown, minimum: number, maximum: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isReaction = (value: unknown): value is Reaction =>
  typeof value === "string" && REACTIONS.some((reaction) => reaction === value);

const isTalkState = (value: unknown): value is TalkState =>
  value === "Talk" || value === "talkb" || value === "talkc" || value === "talkbc";

const isMorphForm = (value: unknown): value is MorphForm =>
  value === "star" || value === "square" || value === "triangle";

function isPersonality(value: unknown): value is Personality {
  if (!isRecord(value) || !hasExactKeys(value, ["energy", "trust", "curiosity"])) return false;
  return (
    isFiniteInRange(value.energy, 0, 100) &&
    isFiniteInRange(value.trust, 0, 100) &&
    isFiniteInRange(value.curiosity, 0, 100)
  );
}

function isWorldState(value: unknown): value is CreatureWorldState {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["userContext", "interaction", "creature", "session"]) ||
    typeof value.userContext !== "string"
  ) return false;
  if (value.userContext.length > BRAIN_CONFIG.contextMaxLength) return false;
  if (
    !isRecord(value.interaction) ||
    !hasExactKeys(value.interaction, ["idleSeconds", "returnedAfterAbsence", "absenceSeconds"]) ||
    !isRecord(value.creature) ||
    !hasExactKeys(value.creature, ["previousReaction", "secondsSinceReaction", "personality"]) ||
    !isRecord(value.session) ||
    !hasExactKeys(value.session, ["secondsAlive"])
  ) {
    return false;
  }

  const interaction = value.interaction;
  const creature = value.creature;
  const session = value.session;

  return (
    isFiniteInRange(interaction.idleSeconds, 0, 86_400) &&
    isBoolean(interaction.returnedAfterAbsence) &&
    isFiniteInRange(interaction.absenceSeconds, 0, 604_800) &&
    isReaction(creature.previousReaction) &&
    isFiniteInRange(creature.secondsSinceReaction, 0, 86_400) &&
    isPersonality(creature.personality) &&
    isFiniteInRange(session.secondsAlive, 0, 604_800)
  );
}

function getClientId(request: ApiRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || "unknown";
  return request.socket.remoteAddress || "unknown";
}

function isRateLimited(clientId: string) {
  const now = Date.now();
  if (rateBuckets.size > 500) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
    if (rateBuckets.size > 1000) rateBuckets.clear();
  }
  const current = rateBuckets.get(clientId);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(clientId, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > SERVER_RATE_LIMIT;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Allow", "POST");

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (isRateLimited(getClientId(request))) {
    return response.status(429).json({ error: "Decision rate exceeded" });
  }

  const body: unknown = request.body;
  if (!isRecord(body) || !isWorldState(body.state)) {
    return response.status(400).json({ error: "Invalid creature state" });
  }

  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    return response.status(200).json({ unavailable: true });
  }

  try {
    const client = new TypeSafeClient({
      apiKey,
      defaultModel: process.env.JEV_MODEL?.trim() || "jev-latest",
      timeout: 5500,
      logLevel: "off",
      retry: { maxRetries: 0 },
    });

    const result = await client.systemOne(
      {
        state: {
          message: body.state.userContext.trim(),
          previous: body.state.creature.previousReaction,
          personality: body.state.creature.personality,
          idleSeconds: Math.round(body.state.interaction.idleSeconds),
          returned: body.state.interaction.returnedAfterAbsence,
          absenceSeconds: Math.round(body.state.interaction.absenceSeconds),
        },
        questions: {
          actionType: choice(
            "Jev is a calm creature with preferences. Choose one action for state.message. Priority: explicit shape change=MORPH (honor named form); explicit request for explanation or words beyond yes/no=TALK; answerable yes/no question=YES or NO, including personal tastes ('¿Te gusta el helado?'=YES or NO as Jev, no clarification/disclaimer). Use TALK only for open questions that genuinely need words, essential clarification, or explicit requests for a longer spoken reply. Uncertain facts: do not invent. Greetings, statements, emotions, unclear fragments and no request=REACTION; prefer silence.",
            {
              REACTION: "Silent visual response.",
              YES: "Binary yes, including Jev's preferences.",
              NO: "Binary no, including Jev's preferences.",
              TALK: "Words required by open question, essential clarification or explicit speech request.",
              MORPH: "Explicit temporary shape change.",
            },
          ),
          reaction: choice(
            "Follow state.message intent; prefer restraint and continuity. Scaring/threats=GHOST; greeting/return=HELLO; affection/reassurance/delight=FLOWER; otherwise BASE.",
            {
              BASE: "Quiet observation.",
              HELLO: "Greeting or reunion.",
              GHOST: "Fear or playful scare.",
              FLOWER: "Affection or delight.",
            },
          ),
          talkState: choice(
            "Talk by default; vary only when context fits. Animation, not speech text.",
            {
              Talk: "Default.",
              talkb: "Variant B.",
              talkc: "Variant C.",
              talkbc: "Variant BC.",
            },
          ),
          morphForm: choice(
            "For MORPH, honor explicitly named supported shape exactly. Unnamed request: choose star, square, or triangle. Match Spanish or English shape names.",
            {
              star: "Estrella / star (Rive enum MorphState).",
              square: "Cuadrado / square.",
              triangle: "Triángulo / triangle.",
            },
          ),
          intensity: score(
            "Ambient energy?",
            [
              "CALM: quiet",
              "ENGAGED: attentive",
              "INTENSE: strong",
            ],
          ),
          wantsAttention: noul(
            "Want interaction?",
            {
              true: "Seeks attention.",
              false: "Prefers quiet.",
            },
          ),
        },
      },
      { timeout: 5500, retry: { maxRetries: 0 } },
    );

    const rawActionType = result.answers.actionType.choice;
    const rawReaction = result.answers.reaction.choice;
    const rawTalkState = result.answers.talkState.choice;
    const rawMorphForm = result.answers.morphForm.choice;
    const actionConfidence = result.answers.actionType.confidence;
    const reactionConfidence = result.answers.reaction.confidence;
    const probabilities = result.answers.reaction.probabilities;
    const intensity = result.answers.intensity.score;
    const wantsAttention = result.answers.wantsAttention.noul;
    if (!isReaction(rawReaction)) {
      return response.status(200).json({ unavailable: true });
    }
    if (
      !isFiniteInRange(actionConfidence, 0, 1) ||
      !isFiniteInRange(reactionConfidence, 0, 1) ||
      !REACTIONS.every((reaction) => isFiniteInRange(probabilities[reaction], 0, 1)) ||
      !isFiniteInRange(intensity, 0, 2) ||
      !isFiniteInRange(wantsAttention, 0, 1)
    ) {
      return response.status(200).json({ unavailable: true });
    }

    let action: DecisionAction;
    switch (rawActionType) {
      case "REACTION":
        action = { kind: "reaction", reaction: rawReaction };
        break;
      case "YES":
        action = { kind: "answer", answer: "yes" };
        break;
      case "NO":
        action = { kind: "answer", answer: "no" };
        break;
      case "TALK":
        if (!isTalkState(rawTalkState)) return response.status(200).json({ unavailable: true });
        action = { kind: "talk", state: rawTalkState };
        break;
      case "MORPH":
        if (!isMorphForm(rawMorphForm)) return response.status(200).json({ unavailable: true });
        action = { kind: "morph", form: requestedMorphForm(body.state.userContext) ?? rawMorphForm };
        break;
      default:
        return response.status(200).json({ unavailable: true });
    }

    const decision: BrainDecision = {
      action,
      actionConfidence,
      reaction: rawReaction,
      reactionConfidence,
      probabilities: {
        BASE: probabilities.BASE,
        HELLO: probabilities.HELLO,
        GHOST: probabilities.GHOST,
        FLOWER: probabilities.FLOWER,
      },
      intensity,
      wantsAttention,
      source: "jev",
    };

    return response.status(200).json(decision);
  } catch (error) {
    const status = isRecord(error) && typeof error.status === "number" ? error.status : null;
    const name = error instanceof Error ? error.name : "UnknownError";
    const cause = isRecord(error) && isRecord(error.cause) ? error.cause : null;
    const code = isRecord(error) && typeof error.code === "string"
      ? error.code
      : cause && typeof cause.code === "string" ? cause.code : null;
    console.error("[api/decide] Jev request failed", { name, status, code });
    return response.status(200).json({ unavailable: true });
  }
}
