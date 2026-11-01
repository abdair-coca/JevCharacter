import { useState, type FormEvent } from "react";
import { AnimatePresence, m } from "motion/react";
import { BRAIN_CONFIG } from "../creature/brain/brainConfig";
import type { BrainStatus } from "../creature/brain/brain.types";
import type { HandsFreeNotice, HandsFreeStatus } from "../creature/listen/useHandsFree";
import { useTranslation } from "../i18n/useTranslation";
import { useFeedbackScale, useOrganicMotion, useUiMotion } from "../lib/motionTokens";
import { Button } from "./ui/button";

export type ListenControl = { status: HandsFreeStatus; notice: HandsFreeNotice; heard: string; onToggle: () => void };

type Props = {
  context: string;
  onSubmit: (context: string) => void;
  onClear: () => void;
  status?: BrainStatus;
  attention?: number;
  /** Hands-free microphone; without it the field is text only. */
  listen?: ListenControl;
};

type Messages = ReturnType<typeof useTranslation>;

const NOTICE_TEXT: Record<Exclude<HandsFreeNotice, null>, keyof Messages> = {
  denied: "listenDenied", noMic: "listenNoMic", unsupported: "listenUnsupported", needsKey: "listenNeedsKey", quota: "listenQuota",
};

function ListenLine({ listen, t }: { listen: ListenControl; t: Messages }) {
  const { status, notice, heard } = listen;
  if (notice) return <>{t[NOTICE_TEXT[notice]]}</>;
  if (status === "starting") return <>{t.listenStarting}</>;
  if (status === "hearing") return <>{t.listenHearing}</>;
  if (status === "transcribing") return <>{t.listenTranscribing}</>;
  if (status === "listening") return heard ? <>{t.listenHeard} <q>{heard}</q></> : <>{t.listenOn}</>;
  return null;
}

export default function ContextWhisper({ context, onSubmit, onClear, status = "observing", listen }: Props) {
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
    <div className="whisper-wrap" data-focused={focused} data-filled={hasText} data-activity={status} data-listen={listen?.status}>
      <div className="whisper-shell">
        <form className="whisper" onSubmit={submit}>
          <div className="whisper__field">
            <div className="sr-only">
              <label htmlFor="creature-context">{t.input}</label>
              {status === "deciding" && <span className="whisper__thinking">{t.deciding}</span>}
            </div>
            <input id="creature-context" value={value}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onChange={(event) => { setValue(event.target.value); setSent(false); }}
              onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.blur(); }}
              maxLength={BRAIN_CONFIG.contextMaxLength} placeholder={t.placeholder} autoComplete="off" />
          </div>
          {listen && (
            <Button className="whisper__mic" type="button" variant="ghost" size="icon" aria-pressed={listen.status !== "off"} aria-label={t.listen} onClick={listen.onToggle}>
              <span className="whisper__mic-ring" aria-hidden="true" />
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
            </Button>
          )}
          {/* whileTap makes a plain div focusable; the button inside is the only tab stop. */}
          <m.div className="whisper__send-wrap" tabIndex={-1} whileTap={{ scale: motion.reduced ? 1 : motion.pressScale }} transition={motion.spring}>
            <Button className="whisper__send" type="submit" size="icon" disabled={!hasText} aria-label={t.send}>
              <AnimatePresence mode="wait" initial={false}>
                {/* On send the arrow shoots off the way it points, then the check settles in. */}
                <m.span key={sent ? "received" : "send"} initial={{ opacity: 0, scale: motion.reduced ? 1 : motion.revealScale }} animate={{ opacity: 1, scale: 1 }}
                  exit={sent || motion.reduced ? { opacity: 0 } : { opacity: 0, x: "var(--motion-fly)", y: "var(--motion-fly-up)" }} transition={transition}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">{sent ? <path d="m6 12 4 4 8-8" /> : <path d="M6 17 17 6M6 6h11v11" />}</svg>
                </m.span>
              </AnimatePresence>
            </Button>
          </m.div>
          {submission > 0 && !motion.reduced && <m.span key={submission} className="whisper__pulse" aria-hidden="true" initial={{ opacity: 1, scale: 1 }} animate={{ opacity: 0, scale: feedbackScale }} transition={transition} />}
        </form>
      </div>
      <div className="whisper__meta">
        {listen && (listen.status !== "off" || listen.notice) && <span className="whisper__listen" aria-hidden="true"><ListenLine listen={listen} t={t} /></span>}
        <AnimatePresence initial={false}>
          {context && <m.button key="clear" type="button" onClick={() => { setSent(false); onClear(); }} aria-label={t.clear} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}><span>{t.clear}</span></m.button>}
        </AnimatePresence>
        {value.length > BRAIN_CONFIG.contextMaxLength - 45 && <span className="whisper__count" aria-live="polite">{value.length}/{BRAIN_CONFIG.contextMaxLength}</span>}
      </div>
      <span className="sr-only" role="status">{sent ? t.received : ""}</span>
      {/* Only notices and what Jev heard are announced, not every phrase it starts hearing. */}
      {listen && <span className="sr-only" role="status">{listen.notice ? t[NOTICE_TEXT[listen.notice]] : listen.heard ? `${t.listenHeard} ${listen.heard}` : ""}</span>}
    </div>
  );
}
