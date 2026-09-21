export const BRAIN_CONFIG = {
  contextMaxLength: 280,
  schedulerPollMs: 420,
  periodicDecisionMs: 4200,
  decisionCooldownMs: 3000,
  strongReactionCooldownMs: 2400,
  idleStopMs: 45_000,
  requestTimeoutMs: 6500,
  maxRequestsPerMinute: 9,
  cacheTtlMs: 6500,
  lowConfidenceThreshold: 0.42,
  clickWindowMs: 1200,
  clickBurstCount: 3,
  nearDistancePx: 260,
  strongMotionSpeed: 1250,
  maxCursorSpeed: 2400,
  absenceThresholdMs: 1500,
  returnedSignalMs: 10_000,
} as const;

export const REACTION_DURATIONS: Record<string, number> = {
  BASE: 700,
  HELLO: 2100,
  GHOST: 1750,
  FLOWER: 2300,
};
