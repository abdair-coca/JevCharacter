import { useState, type FormEvent } from "react";
import { AnimatePresence, m } from "motion/react";
import { BRAIN_CONFIG } from "../creature/brain/brainConfig";
import type { BrainStatus } from "../creature/brain/brain.types";
import { useTranslation } from "../i18n/useTranslation";
import { useFeedbackScale, useOrganicMotion, useUiMotion } from "../lib/motionTokens";
import OrganicLight from "./OrganicLight";
import { Button } from "./ui/button";

type Props = {
  context: string;
  onSubmit: (context: string) => void;
  onClear: () => void;
  status?: BrainStatus;
  attention?: number;
};

export default function ContextWhisper({ context, onSubmit, onClear, status = "observing", attention = 0 }: Props) {
  const t = useTranslation();
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const [submission, setSubmission] = useState(0);
  const [focused, setFocused] = useState(false);
  const transition = useUiMotion();
  const motion = useOrganicMotion();
  const feedbackScale = useFeedbackScale();
  const hasText = Boolean(value.trim());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = value.trim();
    if (!next) return;
    onSubmit(next);
    setValue("");
    setSent(true);
    setSubmission((current) => current + 1);
  };

  return (
    <div className="whisper-wrap" data-focused={focused} data-filled={hasText} data-activity={status}>
      <div className="whisper-shell">
        <OrganicLight status={status} attention={attention} emphasized={focused || hasText} />
        <form className="whisper" onSubmit={submit}>
          <m.span className="whisper__presence" aria-hidden="true" initial={false}
            animate={{ scale: focused && !motion.reduced ? feedbackScale : 1 }} transition={motion.spring}><i /><i /></m.span>
          <div className="whisper__field">
            <div className="whisper__label-row">
              <label htmlFor="creature-context">{t.input}</label>
              {status === "deciding" && <span className="whisper__thinking">{t.deciding}</span>}
            </div>
            <input id="creature-context" value={value}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onChange={(event) => { setValue(event.target.value); setSent(false); }}
              onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.blur(); }}
              maxLength={BRAIN_CONFIG.contextMaxLength} placeholder={t.placeholder} autoComplete="off" aria-describedby="context-help" />
          </div>
          <m.div className="whisper__send-wrap" whileTap={{ scale: motion.reduced ? 1 : motion.pressScale }} transition={motion.spring}>
            <Button className="whisper__send" type="submit" size="icon" disabled={!hasText} aria-label={t.send}>
              <AnimatePresence mode="wait" initial={false}>
                <m.span key={sent ? "received" : "send"} initial={{ opacity: 0, scale: motion.reduced ? 1 : motion.revealScale }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={transition}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">{sent ? <path d="m6 12 4 4 8-8" /> : <path d="M6 17 17 6M6 6h11v11" />}</svg>
                </m.span>
              </AnimatePresence>
            </Button>
          </m.div>
          {submission > 0 && !motion.reduced && <m.span key={submission} className="whisper__pulse" aria-hidden="true" initial={{ opacity: 1, scale: 1 }} animate={{ opacity: 0, scale: feedbackScale }} transition={transition} />}
        </form>
      </div>
      <div className="whisper__meta">
        <span id="context-help">{t.inputHelp}</span>
        {context && <button type="button" onClick={() => { setSent(false); onClear(); }} aria-label={t.clear}>{t.contextHeld} · <span>{t.clear}</span></button>}
        {value.length > BRAIN_CONFIG.contextMaxLength - 45 && <span className="whisper__count" aria-live="polite">{value.length}/{BRAIN_CONFIG.contextMaxLength}</span>}
      </div>
      <span className="sr-only" role="status">{sent ? t.received : ""}</span>
    </div>
  );
}
