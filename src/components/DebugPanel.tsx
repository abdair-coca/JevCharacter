import { useEffect, useState } from "react";

import { CHARACTER_STATES, type CharacterState } from "../character/useCharacterController";
import { type BrainDecision, type Personality, type SensorSnapshot } from "../creature/brain/brain.types";

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
  const [snapshot, setSnapshot] = useState<SensorSnapshot | null>(null);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setSnapshot(getSnapshot()), 250);
    return () => window.clearInterval(timer);
  }, [active, getSnapshot]);

  if (!active || !snapshot) return null;

  return (
    <aside className="debug-panel" aria-label="Jevling debug mode">
      <div className="debug-panel__head">
        <span>DEBUG / LIVE SIGNAL</span>
        <button type="button" onClick={onClose} aria-label="Close debug mode">×</button>
      </div>
      <dl>
        <div><dt>distance</dt><dd>{snapshot.cursorDistance}px</dd></div>
        <div><dt>speed</dt><dd>{snapshot.cursorSpeed}px/s</dd></div>
        <div><dt>near</dt><dd>{String(snapshot.cursorNearCreature)}</dd></div>
        <div><dt>idle</dt><dd>{snapshot.idleSeconds.toFixed(1)}s</dd></div>
        <div><dt>clicks</dt><dd>{snapshot.recentClicks}</dd></div>
        <div><dt>absence</dt><dd>{snapshot.absenceSeconds.toFixed(1)}s</dd></div>
        <div><dt>energy</dt><dd>{personality.energy.toFixed(1)}</dd></div>
        <div><dt>trust</dt><dd>{personality.trust.toFixed(1)}</dd></div>
        <div><dt>curiosity</dt><dd>{personality.curiosity.toFixed(1)}</dd></div>
        <div><dt>reaction</dt><dd>{decision.reaction}</dd></div>
        <div><dt>confidence</dt><dd>{decision.reactionConfidence.toFixed(2)}</dd></div>
        <div><dt>source</dt><dd>{decision.source}</dd></div>
        <div><dt>latency</dt><dd>{latencyMs}ms</dd></div>
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
