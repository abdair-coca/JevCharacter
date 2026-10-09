import { describe, expect, it, vi } from "vitest";
import { REACTION_DURATIONS } from "../src/creature/brain/brainConfig";
import { executeDecisionAction } from "../src/creature/rive/riveReactionAdapter";
import type { CharacterController } from "../src/character/useCharacterController";
import type { BrainDecision } from "../src/creature/brain/brain.types";

describe("QUESTION reaction", () => {
  it("routes the remote reaction to the lowercase Rive state as a temporary gesture", async () => {
    const character = {
      playFor: vi.fn(),
      idle: vi.fn(),
      cloud: vi.fn(),
      answer: vi.fn(),
      talk: vi.fn(),
      morph: vi.fn(),
    };
    const decision: BrainDecision = {
      action: { kind: "reaction", reaction: "QUESTION" },
      actionConfidence: 0.9,
      reaction: "QUESTION",
      reactionConfidence: 0.9,
      probabilities: { QUESTION: 0.9, BASE: 0.1 },
      intensity: 0.5,
      wantsAttention: 0.5,
      source: "jev",
    };

    await executeDecisionAction(character as unknown as CharacterController, decision);

    expect(character.playFor).toHaveBeenCalledWith("question", REACTION_DURATIONS.QUESTION);
    expect(character.answer).not.toHaveBeenCalled();
    expect(character.talk).not.toHaveBeenCalled();
    expect(REACTION_DURATIONS.QUESTION).toBeGreaterThan(0);
  });
});
