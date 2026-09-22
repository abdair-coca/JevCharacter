import { BRAIN_CONFIG } from "./brainConfig";
import type {
  BrainDecision,
  BrainStatus,
  CreatureWorldState,
  DecisionReason,
  Reaction,
  ReactionHistoryEntry,
  SchedulerFrame,
} from "./brain.types";
import { REACTIONS } from "./brain.types";
import { fallbackBrain } from "./fallbackBrain";

type SchedulerOptions = {
  getFrame: () => SchedulerFrame;
  onDecision: (decision: BrainDecision, latencyMs: number, reason: DecisionReason) => void;
  onStatus: (status: BrainStatus) => void;
};

type CachedDecision = {
  decision: BrainDecision;
  savedAt: number;
};

const isReaction = (value: unknown): value is Reaction =>
  typeof value === "string" && REACTIONS.some((reaction) => reaction === value);

const isUnavailableResponse = (value: unknown) => {
  if (!value || typeof value !== "object" || !("unavailable" in value)) return false;
  return value.unavailable === true;
};

function parseDecision(value: unknown): BrainDecision | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<BrainDecision>;
  if (
    !isReaction(candidate.reaction) ||
    typeof candidate.reactionConfidence !== "number" ||
    typeof candidate.intensity !== "number" ||
    typeof candidate.wantsAttention !== "number" ||
    candidate.source !== "jev" ||
    !candidate.probabilities ||
    typeof candidate.probabilities !== "object"
  ) {
    return null;
  }

  const probabilities = candidate.probabilities as Record<string, unknown>;
  if (REACTIONS.some((reaction) => typeof probabilities[reaction] !== "number")) return null;

  return {
    reaction: candidate.reaction,
    reactionConfidence: Math.max(0, Math.min(1, candidate.reactionConfidence)),
    probabilities: {
      BASE: Math.max(0, Math.min(1, probabilities.BASE as number)),
      HELLO: Math.max(0, Math.min(1, probabilities.HELLO as number)),
      GHOST: Math.max(0, Math.min(1, probabilities.GHOST as number)),
      FLOWER: Math.max(0, Math.min(1, probabilities.FLOWER as number)),
    },
    intensity: Math.max(0, Math.min(2, candidate.intensity)),
    wantsAttention: Math.max(0, Math.min(1, candidate.wantsAttention)),
    source: "jev",
  };
}

function fingerprint(state: CreatureWorldState) {
  return JSON.stringify({
    context: state.userContext,
    idle: Math.round(state.interaction.idleSeconds / 4),
    returned: state.interaction.returnedAfterAbsence,
    absence: Math.round(state.interaction.absenceSeconds / 5),
    previous: state.creature.previousReaction,
    energy: Math.round(state.creature.personality.energy / 5),
    trust: Math.round(state.creature.personality.trust / 5),
    curiosity: Math.round(state.creature.personality.curiosity / 5),
  });
}

function cohereDecision(
  decision: BrainDecision,
  state: CreatureWorldState,
  history: ReactionHistoryEntry[],
) {
  let next = decision;
  const dramatic = decision.reaction === "GHOST";

  if (dramatic && decision.reactionConfidence < BRAIN_CONFIG.lowConfidenceThreshold) {
    next = {
      ...decision,
      reaction: "BASE",
      reactionConfidence: decision.probabilities.BASE,
      intensity: Math.min(1, decision.intensity),
    };
  }

  const repeated =
    history.length >= 2 &&
    history.slice(-2).every((entry) => entry.reaction === next.reaction);
  if (next.reaction !== "BASE" && repeated) {
    const alternative = REACTIONS.filter((reaction) => reaction !== next.reaction).sort(
      (left, right) => next.probabilities[right] - next.probabilities[left],
    )[0];
    next = {
      ...next,
      reaction: alternative,
      reactionConfidence: next.probabilities[alternative],
      intensity: alternative === "BASE" ? Math.min(0.8, next.intensity) : next.intensity,
    };
  }

  if (
    next.reaction !== "BASE" &&
    state.creature.secondsSinceReaction * 1000 < BRAIN_CONFIG.strongReactionCooldownMs
  ) {
    next = {
      ...next,
      reaction: "BASE",
      reactionConfidence: next.probabilities.BASE,
      intensity: Math.min(0.7, next.intensity),
    };
  }

  return next;
}

export class DecisionScheduler {
  private readonly options: SchedulerOptions;
  private timer: number | null = null;
  private activeRequest: AbortController | null = null;
  private activeFingerprint = "";
  private lastDecisionAt = 0;
  private requestTimes: number[] = [];
  private history: ReactionHistoryEntry[] = [];
  private cache = new Map<string, CachedDecision>();
  private returnedVersion = 0;

  constructor(options: SchedulerOptions) {
    this.options = options;
  }

  start() {
    if (this.timer !== null) return;
    const initial = this.options.getFrame().sensors;
    this.returnedVersion = initial.eventVersions.returned;
    this.timer = window.setInterval(() => this.tick(), BRAIN_CONFIG.schedulerPollMs);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.activeRequest?.abort();
    this.activeRequest = null;
    this.activeFingerprint = "";
  }

  requestContextDecision() {
    void this.decide("context", true);
  }

  private tick() {
    if (document.visibilityState !== "visible") return;
    const sensors = this.options.getFrame().sensors;
    const now = performance.now();
    const cooledDown = now - this.lastDecisionAt >= BRAIN_CONFIG.decisionCooldownMs;
    if (this.activeRequest) return;

    if (sensors.eventVersions.returned !== this.returnedVersion) {
      if (cooledDown) {
        this.returnedVersion = sensors.eventVersions.returned;
        void this.decide("return");
      }
      return;
    }
  }

  private withinRateLimit() {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter((time) => now - time < 60_000);
    return this.requestTimes.length < BRAIN_CONFIG.maxRequestsPerMinute;
  }

  private async decide(reason: DecisionReason, replaceActive = false) {
    if (document.visibilityState !== "visible") return;
    const frame = this.options.getFrame();
    const stateFingerprint = fingerprint(frame.state);

    if (this.activeRequest) {
      if (!replaceActive) return;
      if (this.activeFingerprint === stateFingerprint) return;
      this.activeRequest.abort();
      this.activeRequest = null;
      this.activeFingerprint = "";
    }

    const now = performance.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.savedAt >= BRAIN_CONFIG.cacheTtlMs) this.cache.delete(key);
    }
    const cached = this.cache.get(stateFingerprint);

    if (cached && now - cached.savedAt < BRAIN_CONFIG.cacheTtlMs) {
      this.finishDecision(cached.decision, frame.state, 0, reason);
      return;
    }

    if (!this.withinRateLimit()) {
      const fallback = fallbackBrain(frame.state, reason);
      this.finishDecision(fallback, frame.state, 0, reason);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), BRAIN_CONFIG.requestTimeoutMs);
    const startedAt = performance.now();
    this.activeRequest = controller;
    this.activeFingerprint = stateFingerprint;
    this.requestTimes.push(Date.now());
    this.options.onStatus("deciding");

    try {
      const response = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: frame.state }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Decision endpoint returned ${response.status}`);
      const payload: unknown = await response.json();
      if (this.activeRequest !== controller) return;
      if (isUnavailableResponse(payload)) {
        const fallback = fallbackBrain(frame.state, reason);
        this.finishDecision(
          fallback,
          frame.state,
          performance.now() - startedAt,
          reason,
        );
        return;
      }
      const decision = parseDecision(payload);
      if (!decision) throw new Error("Decision endpoint returned an invalid response");
      if (this.cache.size >= 40) {
        const oldestKey = this.cache.keys().next().value as string | undefined;
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(stateFingerprint, { decision, savedAt: performance.now() });
      this.finishDecision(
        decision,
        frame.state,
        performance.now() - startedAt,
        reason,
      );
    } catch (error) {
      if (controller.signal.aborted && this.activeRequest !== controller) return;
      if (import.meta.env.DEV) console.warn("[jevling] Jev unavailable; using local instinct", error);
      const fallback = fallbackBrain(frame.state, reason);
      this.finishDecision(
        fallback,
        frame.state,
        performance.now() - startedAt,
        reason,
      );
    } finally {
      window.clearTimeout(timeout);
      if (this.activeRequest === controller) {
        this.activeRequest = null;
        this.activeFingerprint = "";
      }
    }
  }

  private finishDecision(
    rawDecision: BrainDecision,
    state: CreatureWorldState,
    latencyMs: number,
    reason: DecisionReason,
  ) {
    const decision = cohereDecision(rawDecision, state, this.history);
    const timestamp = Date.now();
    this.history = [
      ...this.history,
      { reaction: decision.reaction, confidence: decision.reactionConfidence, timestamp },
    ].slice(-5);
    this.lastDecisionAt = performance.now();
    this.options.onDecision(decision, latencyMs, reason);
    this.options.onStatus("observing");
  }
}
