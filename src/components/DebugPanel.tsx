import { useEffect, useState } from "react";

import { CHARACTER_STATES, type CharacterState } from "../character/useCharacterController";
import { type BrainDecision, type Personality, type SensorSnapshot } from "../creature/brain/brain.types";
import { useTranslation } from "../i18n/useTranslation";

type Props = {
  active: boolean;
  getSnapshot: () => SensorSnapshot;
  personality: Personality;
  decision: BrainDecision;
  latencyMs: number;
  onState: (state: CharacterState) => void;
  onClose: () => void;
};

export default function DebugPanel({
  active,
  getSnapshot,
  personality,
  decision,
  latencyMs,
  onState,
  onClose,
}: Props) {
  const t = useTranslation();
  const [snapshot, setSnapshot] = useState<SensorSnapshot | null>(null);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setSnapshot(getSnapshot()), 250);
    return () => window.clearInterval(timer);
  }, [active, getSnapshot]);

  if (!active || !snapshot) return null;

  return (
    <aside className="debug-panel" aria-label={t.diagnostics}>
      <div className="debug-panel__head">
        <span>{t.debugSignal}</span>
        <button type="button" onClick={onClose} aria-label={t.close}>×</button>
      </div>
      <dl>
        <div><dt>{t.distance}</dt><dd>{snapshot.cursorDistance}px</dd></div>
        <div><dt>{t.speed}</dt><dd>{snapshot.cursorSpeed}px/s</dd></div>
        <div><dt>{t.near}</dt><dd>{snapshot.cursorNearCreature ? t.YES : t.NO}</dd></div>
        <div><dt>{t.idle}</dt><dd>{snapshot.idleSeconds.toFixed(1)}s</dd></div>
        <div><dt>{t.clicks}</dt><dd>{snapshot.recentClicks}</dd></div>
        <div><dt>{t.absence}</dt><dd>{snapshot.absenceSeconds.toFixed(1)}s</dd></div>
        <div><dt>{t.energy}</dt><dd>{personality.energy.toFixed(1)}</dd></div>
        <div><dt>{t.trust}</dt><dd>{personality.trust.toFixed(1)}</dd></div>
        <div><dt>{t.curiosity}</dt><dd>{personality.curiosity.toFixed(1)}</dd></div>
        <div><dt>{t.decision}</dt><dd>{decision.action.kind}</dd></div>
        <div><dt>{t.confidence}</dt><dd>{decision.actionConfidence.toFixed(2)}</dd></div>
        <div><dt>{t.reaction}</dt><dd>{decision.reaction}</dd></div>
        <div><dt>{t.reactionConfidence}</dt><dd>{decision.reactionConfidence.toFixed(2)}</dd></div>
        <div><dt>{t.source}</dt><dd>{decision.source === "jev" ? t.online : t.local}</dd></div>
        <div><dt>{t.latency}</dt><dd>{latencyMs}ms</dd></div>
      </dl>
      <div className="debug-panel__actions">
        {CHARACTER_STATES.map((state) => (
          <button type="button" key={state} onClick={() => onState(state)}>
            {state}
          </button>
        ))}
      </div>
    </aside>
  );
}
