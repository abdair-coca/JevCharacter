import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { m } from "motion/react";
import type { SpeechDetail } from "../../hooks/useSpeechSession";
import { useReducedMotionPreference } from "../../hooks/useReducedMotionPreference";
import { useTranslation } from "../../i18n/useTranslation";
import { useUiMotion } from "../../lib/motionTokens";
import { ChoiceButtons, ReplyBlocks, Words } from "./ReplyBlocks";
import "./reply.css";

export function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

/**
 * The reply's own scroller. It stays at the top while blocks stream in; content
 * below the fold is announced by a "More" control instead of moving the reader.
 */
export type Ask = (question: string) => void;

export function ReplyScroll({ detail, onAsk, onScrolled }: { detail: SpeechDetail; onAsk?: Ask; onScrolled?: () => void }) {
  const t = useTranslation();
  const reduced = useReducedMotionPreference();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ above: false, below: false });
  const measure = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const below = element.scrollHeight - element.scrollTop - element.clientHeight > 4;
    const above = element.scrollTop > 4;
    setEdges(current => current.above === above && current.below === below ? current : { above, below });
  }, []);
  useLayoutEffect(measure, [measure, detail.blocks]);
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);
  const scrollMore = () => {
    const element = scroller.current;
    element?.scrollBy({ top: element.clientHeight * 0.8, behavior: reduced ? "auto" : "smooth" });
  };
  return (
    <div className="reply__body">
      <div ref={scroller} className="reply__scroll" tabIndex={0} role="region" aria-label={t.reply}
        data-above={edges.above} data-below={edges.below}
        onScroll={() => { measure(); onScrolled?.(); }}>
        <p className="reply__lead"><Words text={detail.spoken} /></p>
        <ReplyBlocks blocks={detail.blocks} onAsk={onAsk} />
      </div>
      {edges.below && (
        <button type="button" className="reply__more" onClick={scrollMore}>
          {t.replyMore} <span aria-hidden="true">↓</span>
        </button>
      )}
    </div>
  );
}

/** Desktop: a card beside Jev that stays until it is closed or replaced. */
export function ReplyCard({ detail, onClose, onAsk }: { detail: SpeechDetail; onClose: () => void; onAsk?: Ask }) {
  const t = useTranslation();
  const transition = useUiMotion();
  const reduced = useReducedMotionPreference();
  const headingId = useId();
  const card = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    // Focus inside the card would be lost with it: hand it back to the input.
    if (card.current?.contains(document.activeElement)) document.getElementById("creature-context")?.focus({ preventScroll: true });
    onClose();
  }, [onClose]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      const typing = target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']");
      if (typing && !card.current?.contains(target)) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);
  return (
    <m.section ref={card} className="reply reply-card" lang={detail.language} aria-labelledby={headingId}
      initial={{ opacity: 0, y: reduced ? 0 : "var(--motion-distance-md)" }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : "var(--motion-distance-sm)" }} transition={transition}>
      <header className="reply__head">
        <h2 id={headingId} className="reply__eyebrow">{t.replyEyebrow}</h2>
        <button type="button" className="reply__close" onClick={close} aria-label={t.replyClose}><CloseIcon /></button>
      </header>
      <ReplyScroll detail={detail} onAsk={onAsk} />
    </m.section>
  );
}

/** Mobile: the spoken sentence above the input, opening the full reply in a sheet. Jev's question can be answered here. */
export function ReplyPreview({ detail, onOpen, onClose, openRef, onAsk }: { detail: SpeechDetail; onOpen: () => void; onClose: () => void; openRef: RefObject<HTMLButtonElement | null>; onAsk?: Ask }) {
  const t = useTranslation();
  const transition = useUiMotion();
  const textId = useId();
  const choices = detail.blocks.find(block => block.type === "choices");
  return (
    <m.div className="reply-preview" lang={detail.language} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
      <p id={textId} className="reply-preview__text">{detail.spoken}</p>
      {choices && <ChoiceButtons block={choices} onAsk={onAsk} labelledBy={textId} />}
      <div className="reply-preview__actions">
        <button ref={openRef} type="button" className="reply-preview__open" onClick={onOpen} aria-haspopup="dialog">{t.replyReadAll}</button>
        <button type="button" className="reply__close" onClick={onClose} aria-label={t.replyClose}><CloseIcon /></button>
      </div>
    </m.div>
  );
}
