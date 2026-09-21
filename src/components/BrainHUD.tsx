import { useState } from "react";

import { REACTIONS, type BrainDecision, type BrainStatus, type Personality } from "../creature/brain/brain.types";

type Props = {
  decision: BrainDecision;
  status: BrainStatus;
  personality: Personality;
};

const intensityLabel = (intensity: number) => {
  if (intensity < 0.67) return "CALM";
  if (intensity < 1.5) return "ENGAGED";
  return "INTENSE";
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="brain-hud__metric">
    <span>{label}</span>
    <i><b style={{ width: `${Math.round(value)}%` }} /></i>
    <strong>{Math.round(value)}</strong>
  </div>
);

export default function BrainHUD({ decision, status, personality }: Props) {
  const [expanded, setExpanded] = useState(false);
  const confidence = Math.round(decision.reactionConfidence * 100);
  const headline = status === "deciding" ? "DECIDING" : decision.reaction;

  return (
    <aside className={`brain-hud ${expanded ? "brain-hud--expanded" : ""}`}>
      <button
        className="brain-hud__summary"
        type="button"
        aria-expanded={expanded}
        aria-controls="brain-details"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={`brain-hud__signal ${status === "deciding" ? "is-thinking" : ""}`} />
        <span className="brain-hud__headline" aria-live="polite">{headline}</span>
        <span className="brain-hud__separator" />
        <span>{confidence}%</span>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m5 6 3 3 3-3" />
        </svg>
      </button>

      <div className="brain-hud__details" id="brain-details" aria-hidden={!expanded}>
        <div className="brain-hud__eyebrow">
          <span>BEHAVIOR PROBABILITY</span>
          <span>{decision.source === "jev" ? "JEV ONLINE" : "LOCAL INSTINCT"}</span>
        </div>
        <div className="brain-hud__probabilities">
          {[...REACTIONS]
            .sort((left, right) => decision.probabilities[right] - decision.probabilities[left])
            .map((reaction) => (
              <div className="brain-hud__probability" key={reaction}>
                <span>{reaction}</span>
                <i><b style={{ width: `${decision.probabilities[reaction] * 100}%` }} /></i>
                <strong>{decision.probabilities[reaction].toFixed(2)}</strong>
              </div>
            ))}
        </div>
        <div className="brain-hud__readings">
          <span>INTENSITY <strong>{intensityLabel(decision.intensity)}</strong></span>
          <span>ATTENTION <strong>{Math.round(decision.wantsAttention * 100)}%</strong></span>
        </div>
        <div className="brain-hud__personality">
          <Metric label="energy" value={personality.energy} />
          <Metric label="trust" value={personality.trust} />
          <Metric label="curiosity" value={personality.curiosity} />
        </div>
      </div>
    </aside>
  );
}
