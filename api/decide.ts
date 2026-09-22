import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";

import { BRAIN_CONFIG } from "../src/creature/brain/brainConfig";
import {
  REACTIONS,
  type BrainDecision,
  type CreatureWorldState,
  type Personality,
  type Reaction,
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

const isFiniteInRange = (value: unknown, minimum: number, maximum: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isReaction = (value: unknown): value is Reaction =>
  typeof value === "string" && REACTIONS.some((reaction) => reaction === value);

function isPersonality(value: unknown): value is Personality {
  if (!isRecord(value)) return false;
  return (
    isFiniteInRange(value.energy, 0, 100) &&
    isFiniteInRange(value.trust, 0, 100) &&
    isFiniteInRange(value.curiosity, 0, 100)
  );
}

function isWorldState(value: unknown): value is CreatureWorldState {
  if (!isRecord(value) || typeof value.userContext !== "string") return false;
  if (value.userContext.length > BRAIN_CONFIG.contextMaxLength) return false;
  if (!isRecord(value.interaction) || !isRecord(value.creature) || !isRecord(value.session)) {
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
        state: body.state,
        questions: {
          reaction: choice(
            "Choose the most coherent visible behavior for this creature now. Read state.userContext as direct user intent and give it priority. A submitted message is not automatically a greeting. Prefer restraint and continuity; doing little is often intentional. Interpret explicit intent such as scare, frighten, intimidate, threaten, or a playful attempt to frighten as GHOST. Use HELLO only for a greeting, arrival, or reunion; use FLOWER for affection, reassurance, or delight; otherwise use BASE.",
            {
              BASE: "Neutral observation. Stay present without a dramatic action.",
              HELLO: "Warm recognition for an explicit greeting, arrival, reunion, or friendly acknowledgment.",
              GHOST: "Startled, wary, strange, or dramatic response to explicit frightening, threatening, intimidating, or playful-scaring intent in the user's context.",
              FLOWER: "Gentle affection, trust, delight, reassurance, or curious warmth.",
            },
          ),
          intensity: score(
            "How much ambient visual energy should surround the creature?",
            [
              "CALM: nearly still, quiet atmosphere",
              "ENGAGED: visibly attentive with moderate ambient motion",
              "INTENSE: strong but elegant environmental response",
            ],
          ),
          wantsAttention: noul(
            "Does the creature currently want the user to interact with it?",
            {
              true: "It seeks attention or further interaction.",
              false: "It prefers quiet observation or space.",
            },
          ),
        },
      },
      { timeout: 5500, retry: { maxRetries: 0 } },
    );

    const decision: BrainDecision = {
      reaction: result.answers.reaction.choice,
      reactionConfidence: result.answers.reaction.confidence,
      probabilities: {
        BASE: result.answers.reaction.probabilities.BASE,
        HELLO: result.answers.reaction.probabilities.HELLO,
        GHOST: result.answers.reaction.probabilities.GHOST,
        FLOWER: result.answers.reaction.probabilities.FLOWER,
      },
      intensity: result.answers.intensity.score,
      wantsAttention: result.answers.wantsAttention.noul,
      source: "jev",
    };

    return response.status(200).json(decision);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[api/decide] Jev request failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
    return response.status(200).json({ unavailable: true });
  }
}
