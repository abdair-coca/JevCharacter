import type {
  BrainDecision,
  CreatureWorldState,
  DecisionReason,
  Reaction,
  ReactionProbabilities,
} from "./brain.types";

const emptyProbabilities = (): ReactionProbabilities => ({
  BASE: 0.08,
  HELLO: 0.08,
  GHOST: 0.08,
  FLOWER: 0.08,
});

const normalizeContext = (context: string) =>
  context
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const inferContextReaction = (context: string): Reaction => {
  const normalized = normalizeContext(context);
  if (!normalized.trim()) return "BASE";

  if (
    /\b(scare|scaring|scared|frighten|frightening|frightened|spook|spooky|terrify|terrifying|intimidat|threaten|threat|fear|asust|espant|amenaz|miedo)\b/.test(
      normalized,
    )
  ) {
    return "GHOST";
  }

  if (
    /\b(hello|hi|hey|hola|buenas|welcome|bienvenido|good morning|good evening|i am back|im back|volvi|regrese)\b/.test(
      normalized,
    )
  ) {
    return "HELLO";
  }

  if (
    /\b(love|like you|friend|happy|proud|trust|miss you|te quiero|amor|amigo|feliz|orgull|confio|te extrane|gracias|thank)\b/.test(
      normalized,
    )
  ) {
    return "FLOWER";
  }

  // An unknown message still deserves a small, warm acknowledgment offline.
  return "FLOWER";
};

export function fallbackBrain(
  state: CreatureWorldState,
  reason: DecisionReason,
): BrainDecision {
  const probabilities = emptyProbabilities();
  const { interaction } = state;
  const personality = state.creature.personality;
  let reaction: Reaction = "BASE";

  probabilities.BASE = 0.55;

  if (reason === "return") {
    reaction = "HELLO";
    probabilities.HELLO = 0.74;
    probabilities.BASE = 0.15;
  } else if (reason === "context") {
    reaction = inferContextReaction(state.userContext);
    if (reaction === "GHOST") {
      probabilities.GHOST = 0.78;
      probabilities.BASE = 0.12;
    } else if (reaction === "HELLO") {
      probabilities.HELLO = 0.74;
      probabilities.BASE = 0.15;
    } else if (reaction === "FLOWER") {
      probabilities.FLOWER = state.userContext.trim() ? 0.58 : 0.08;
      probabilities.BASE = state.userContext.trim() ? 0.25 : 0.72;
    }
  }

  const confidence = probabilities[reaction];
  const intensity = reaction === "GHOST" ? 1.35 : reaction === "BASE" ? 0.35 : 1.05;
  const wantsAttention = Math.max(
    0.08,
    Math.min(0.92, personality.curiosity / 130 + (interaction.idleSeconds > 12 ? 0.12 : 0)),
  );

  return {
    reaction,
    reactionConfidence: confidence,
    probabilities,
    intensity,
    wantsAttention,
    source: "fallback",
  };
}
