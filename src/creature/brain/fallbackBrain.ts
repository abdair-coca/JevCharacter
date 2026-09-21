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

export function fallbackBrain(
  state: CreatureWorldState,
  reason: DecisionReason,
): BrainDecision {
  const probabilities = emptyProbabilities();
  const { interaction } = state;
  const personality = state.creature.personality;
  let reaction: Reaction = "BASE";

  probabilities.BASE = 0.55;

  if (reason === "return" || interaction.returnedAfterAbsence) {
    reaction = "HELLO";
    probabilities.HELLO = 0.74;
    probabilities.BASE = 0.15;
  } else if (
    reason === "click-burst" ||
    interaction.interactionBurst ||
    (interaction.cursorNearCreature && interaction.cursorSpeed > 1200)
  ) {
    reaction = "GHOST";
    probabilities.GHOST = 0.7;
    probabilities.BASE = 0.17;
  } else if (reason === "context") {
    reaction = personality.trust >= 44 ? "HELLO" : "FLOWER";
    probabilities[reaction] = 0.66;
    probabilities.BASE = 0.2;
  } else if (
    interaction.cursorNearCreature &&
    interaction.cursorSpeed < 500 &&
    personality.curiosity > 74
  ) {
    reaction = "FLOWER";
    probabilities.FLOWER = 0.56;
    probabilities.BASE = 0.27;
  }

  const confidence = probabilities[reaction];
  const intensity =
    reaction === "GHOST" ? 1.85 : reaction === "BASE" ? 0.35 : 1.05;
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
