import type { CharacterController } from "../../character/useCharacterController";
import { REACTION_DURATIONS } from "../brain/brainConfig";
import type { BrainDecision, Reaction } from "../brain/brain.types";

const STATE_BY_REACTION: Partial<Record<Reaction, string>> = {
  BASE: "Base",
  HELLO: "Hello",
  GHOST: "Ghost",
  FLOWER: "Flower",
  CLOUD: "Cloud",
};

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

  if (reaction === "CLOUD") {
    await character.cloud();
    return;
  }

  const state = STATE_BY_REACTION[reaction as keyof typeof STATE_BY_REACTION];
  if (!state) return;

  await character.playFor(state as Parameters<CharacterController["playFor"]>[0], REACTION_DURATIONS[reaction as keyof typeof REACTION_DURATIONS]);
}

export async function executeDecisionAction(
  character: CharacterController | null,
  decision: BrainDecision,
) {
  if (!character) return;

  switch (decision.action.kind) {
    case "reaction":
      await reactWithRive(character, { ...decision, reaction: decision.action.reaction });
      return;
    case "answer":
      await character.answer(decision.action.answer);
      return;
    case "talk":
      await character.talk(decision.action.state);
      return;
    case "morph":
      await character.morph(decision.action.form);
      return;
  }
}

export function playRiveReaction(character: CharacterController | null, reaction: Reaction) {
  return reactWithRive(character, { reaction });
}
