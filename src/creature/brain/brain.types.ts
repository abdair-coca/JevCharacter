export const REACTIONS = ["BASE", "HELLO", "GHOST", "FLOWER"] as const;

export type Reaction = (typeof REACTIONS)[number];
export type BrainSource = "jev" | "fallback";
export type BrainStatus = "observing" | "deciding";

export type Personality = {
  energy: number;
  trust: number;
  curiosity: number;
};

export type PointerKind = "mouse" | "touch" | "pen" | "unknown";

export type SensorSnapshot = {
  cursorPosition: { x: number; y: number };
  cursorDistance: number;
  cursorSpeed: number;
  cursorNearCreature: boolean;
  mouseInsideStage: boolean;
  recentClicks: number;
  interactionBurst: boolean;
  idleSeconds: number;
  returnedAfterAbsence: boolean;
  absenceSeconds: number;
  pointerType: PointerKind;
  pointerDown: boolean;
  pointerHoldSeconds: number;
  sessionSeconds: number;
  interactionCount: number;
  eventVersions: {
    clickBurst: number;
    returned: number;
  };
};

export type CreatureWorldState = {
  userContext: string;
  interaction: {
    idleSeconds: number;
    returnedAfterAbsence: boolean;
    absenceSeconds: number;
  };
  creature: {
    previousReaction: Reaction;
    secondsSinceReaction: number;
    personality: Personality;
  };
  session: {
    secondsAlive: number;
  };
};

export type ReactionProbabilities = Record<Reaction, number>;

export type BrainDecision = {
  reaction: Reaction;
  reactionConfidence: number;
  probabilities: ReactionProbabilities;
  intensity: number;
  wantsAttention: number;
  source: BrainSource;
};

export type ReactionHistoryEntry = {
  reaction: Reaction;
  confidence: number;
  timestamp: number;
};

export type DecisionReason = "context" | "return";

export type SchedulerFrame = {
  state: CreatureWorldState;
  sensors: SensorSnapshot;
};
