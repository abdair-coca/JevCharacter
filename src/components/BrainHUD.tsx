import { useState } from "react";
import { AnimatePresence, m, useIsPresent } from "motion/react";
import { REACTIONS, type BrainDecision, type BrainStatus, type Personality } from "../creature/brain/brain.types";
import { useTranslation } from "../i18n/useTranslation";
import { useOrganicMotion, useUiMotion } from "../lib/motionTokens";
import type { MessageKey } from "../i18n/messages";
import OrganicLight from "./OrganicLight";
import type { SpeechNotice } from "../hooks/useSpeechSession";

type Props = { decision: BrainDecision; status: BrainStatus; personality: Personality; speechNotice?: SpeechNotice; decisionInterrupted?: boolean };

function Metric({ label, value, percent = false }: { label: string; value: number; percent?: boolean }) {
  const motion = useOrganicMotion();
  return (
    <m.div className="brain-hud__metric" layout="position" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
      <span>{label}</span>
      <i aria-hidden="true"><m.b initial={false} animate={{ scaleX: Math.max(0, Math.min(1, value / 100)) }} transition={motion.spring} /></i>
      <strong>{Math.round(value)}{percent ? "%" : ""}</strong>
    </m.div>
  );
}

function actionLabel(decision: BrainDecision, t: Record<MessageKey, string>) {
  switch (decision.action.kind) {
    case "reaction": return t[decision.action.reaction];
    case "answer": return t[decision.action.answer === "yes" ? "YES" : "NO"];
    case "talk": return t.talk;
    case "morph": return t[decision.action.form === "star" ? "STAR" : decision.action.form === "square" ? "SQUARE" : "TRIANGLE"];
  }
}

function HudDetails({ decision, personality }: Pick<Props, "decision" | "personality">) {
  const t = useTranslation();
  const present = useIsPresent();
  const motion = useOrganicMotion();
  const transition = useUiMotion();
  const intensity = decision.intensity < 0.67 ? t.calm : decision.intensity < 1.5 ? t.engaged : t.intense;
  return (
    <m.div className="brain-hud__details" id="brain-details" aria-hidden={!present} inert={!present}
      initial="hidden" animate="visible" exit="hidden"
      variants={{ hidden: { opacity: 0, scale: motion.reduced ? 1 : motion.revealScale }, visible: { opacity: 1, scale: 1, transition: { ...transition, staggerChildren: motion.reduced ? 0 : motion.stagger } } }} transition={transition}>
      <p className="brain-hud__eyebrow">{t.probabilities}</p>
      <div className="brain-hud__probabilities">
        {[...REACTIONS].sort((a, b) => (decision.probabilities[b] ?? 0) - (decision.probabilities[a] ?? 0)).slice(0, 4).map((reaction) => (
          <Metric key={reaction} label={t[reaction]} value={(decision.probabilities[reaction] ?? 0) * 100} percent />
        ))}
      </div>
      <div className="brain-hud__readings">
        <span>{t.intensity}<strong>{intensity}</strong></span>
        <span>{t.attention}<strong>{Math.round(decision.wantsAttention * 100)}<small>%</small></strong></span>
      </div>
      <div className="brain-hud__personality">
        <Metric label={t.energy} value={personality.energy} />
        <Metric label={t.trust} value={personality.trust} />
        <Metric label={t.curiosity} value={personality.curiosity} />
      </div>
      <p className="brain-hud__contract">{decision.action.kind} / {decision.action.kind === "talk" ? decision.action.state : decision.action.kind === "morph" ? decision.action.form : decision.action.kind === "answer" ? decision.action.answer : decision.action.reaction}</p>
    </m.div>
  );
}

export default function BrainHUD({ decision, status, personality, speechNotice, decisionInterrupted = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslation();
  const transition = useUiMotion();
  const motion = useOrganicMotion();
  const confidence = Math.round(decision.actionConfidence * 100);
  const headline = status === "deciding" ? t.deciding : actionLabel(decision, t);
  const notice = speechNotice ? t[speechNotice === "unavailable" ? "speechUnavailable" : speechNotice === "regenerating" ? "speechRegenerating" : "speechInterrupted"] : decisionInterrupted ? t.decisionInterrupted : null;
  return (
    <aside className="brain-hud" aria-label={t.details} data-expanded={expanded} data-activity={status}
      onKeyDown={(event) => { if (event.key === "Escape") setExpanded(false); }}>
      <OrganicLight status={status} attention={decision.wantsAttention} emphasized={status === "deciding"} />
      <m.button className="brain-hud__summary" type="button" layout="position"
        aria-expanded={expanded} aria-controls={expanded ? "brain-details" : undefined}
        onClick={() => setExpanded((value) => !value)} transition={motion.spring}>
        <span className="brain-hud__topline">
          <span className="brain-hud__source"><span className={`brain-hud__signal ${decision.source === "jev" ? "brain-hud__signal--online" : ""}`} aria-hidden="true" /><span className="brain-hud__source-label">{decision.source === "jev" ? t.online : t.local}</span></span>
          <m.span className="brain-hud__chevron" aria-hidden="true" initial={false} animate={{ rotate: expanded ? 0 : 180 }} transition={transition}>
            <svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4" /></svg>
          </m.span>
        </span>
        <span className="brain-hud__reading">
          <span className="brain-hud__presence" aria-hidden="true"><i /><i /></span>
          <span className="brain-hud__action">
            <span className="brain-hud__action-label">{t.decision}</span>
            <span className="brain-hud__headline" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <m.strong key={headline} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>{headline}</m.strong>
              </AnimatePresence>
            </span>
          </span>
          <span className="brain-hud__confidence"><strong>{confidence}<small>%</small></strong><span>{t.confidence}</span></span>
        </span>
      </m.button>
      {notice && <p className="brain-hud__notice" role="status">{notice}</p>}
      <AnimatePresence initial={false}>
        {expanded && <HudDetails decision={decision} personality={personality} />}
      </AnimatePresence>
    </aside>
  );
}
