import type { CharacterController } from "../../character/useCharacterController";
import { REACTION_DURATIONS } from "../brain/brainConfig";
import type { BrainDecision, Reaction } from "../brain/brain.types";

const STATE_BY_REACTION = {
  BASE: "Base",
  HELLO: "Hello",
  GHOST: "Ghost",
  FLOWER: "Flower",
} as const;

export async function reactWithRive(
  character: CharacterController | null,
  decision: Pick<BrainDecision, "reaction">,
) {
  if (!character) return;
  const reaction = decision.reaction;

  if (reaction === "BASE") {
    await character.idle();
    return;
  }

  await character.playFor(STATE_BY_REACTION[reaction], REACTION_DURATIONS[reaction]);
}

export function playRiveReaction(character: CharacterController | null, reaction: Reaction) {
  return reactWithRive(character, { reaction });
}
