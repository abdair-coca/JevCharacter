import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { animate, m, useDragControls, useMotionValue, useTransform, type PanInfo } from "motion/react";
import type { SpeechDetail } from "../../hooks/useSpeechSession";
import { useReducedMotionPreference } from "../../hooks/useReducedMotionPreference";
import { useTranslation } from "../../i18n/useTranslation";
import { useUiMotion } from "../../lib/motionTokens";
import { ReplyBlocks } from "./ReplyBlocks";
import "./reply.css";

const FOCUSABLE = "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])";

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

/**
 * The reply's own scroller. It stays at the top while blocks stream in; content
 * below the fold is announced by a "More" control instead of moving the reader.
 */
function ReplyScroll({ detail, onScrolled }: { detail: SpeechDetail; onScrolled?: () => void }) {
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
        <p className="reply__lead">{detail.spoken}</p>
        <ReplyBlocks blocks={detail.blocks} />
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
export function ReplyCard({ detail, onClose }: { detail: SpeechDetail; onClose: () => void }) {
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
      <ReplyScroll detail={detail} />
    </m.section>
  );
}

/** Mobile: the spoken sentence above the input, opening the full reply in a sheet. */
export function ReplyPreview({ detail, onOpen, onClose, openRef }: { detail: SpeechDetail; onOpen: () => void; onClose: () => void; openRef: RefObject<HTMLButtonElement | null> }) {
  const t = useTranslation();
  const transition = useUiMotion();
  return (
    <m.div className="reply-preview" lang={detail.language} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
      <p className="reply-preview__text">{detail.spoken}</p>
      <div className="reply-preview__actions">
        <button ref={openRef} type="button" className="reply-preview__open" onClick={onOpen} aria-haspopup="dialog">{t.replyReadAll}</button>
        <button type="button" className="reply__close" onClick={onClose} aria-label={t.replyClose}><CloseIcon /></button>
      </div>
    </m.div>
  );
}

type Snap = "full" | "half" | "closed";

/** Mobile: bottom sheet with two heights; dragging it down returns to the preview. */
export function ReplySheet({ detail, onCollapse }: { detail: SpeechDetail; onCollapse: () => void }) {
  const t = useTranslation();
  const transition = useUiMotion();
  const headingId = useId();
  const sheet = useRef<HTMLDivElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const controls = useDragControls();
  const y = useMotionValue(typeof window === "undefined" ? 0 : window.innerHeight);
  const height = () => sheet.current?.offsetHeight || window.innerHeight;
  const backdrop = useTransform(y, value => Math.max(0, 1 - value / height()));
  const [expanded, setExpanded] = useState(false);
  const dragged = useRef(false);

  const snapTo = useCallback((target: Snap) => {
    const full = sheet.current?.offsetHeight || window.innerHeight;
    setExpanded(target === "full");
    const offset = target === "full" ? 0 : target === "half" ? full / 2 : full;
    const animation = animate(y, offset, transition);
    if (target === "closed") void animation.then(onCollapse);
  }, [onCollapse, transition, y]);

  useLayoutEffect(() => {
    y.set(height());
    snapTo("half");
    heading.current?.focus({ preventScroll: true });
    // Opening runs once per sheet; later snaps come from the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const full = height();
    const projected = y.get() + info.velocity.y * 0.2;
    const targets: [Snap, number][] = [["full", 0], ["half", full / 2], ["closed", full]];
    const nearest = targets.reduce((best, current) => Math.abs(current[1] - projected) < Math.abs(best[1] - projected) ? current : best);
    snapTo(nearest[0]);
  };

  // A modal sheet keeps keyboard focus inside until it is closed.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      snapTo("closed");
      return;
    }
    if (event.key !== "Tab" || !sheet.current) return;
    const focusable = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Portalled above the page: Home's stage is its own stacking context, under the fixed header.
  return createPortal(
    <div className="reply-sheet-layer">
      <m.div className="reply-sheet__backdrop" style={{ opacity: backdrop }} onClick={() => snapTo("closed")} aria-hidden="true" />
      <m.div ref={sheet} className="reply reply-sheet" role="dialog" aria-modal="true" aria-labelledby={headingId} lang={detail.language}
        style={{ y }} drag="y" dragListener={false} dragControls={controls} dragConstraints={{ top: 0 }} dragElastic={{ top: 0, bottom: 0.2 }}
        dragMomentum={false} onDragStart={() => { dragged.current = true; }} onDragEnd={onDragEnd} onKeyDown={onKeyDown}>
        <button type="button" className="reply-sheet__handle" aria-label={t.replyHandle} aria-expanded={expanded}
          onPointerDown={event => { dragged.current = false; controls.start(event); }}
          onClick={() => { if (!dragged.current) snapTo(expanded ? "half" : "full"); }}>
          <span aria-hidden="true" />
        </button>
        <header className="reply__head">
          <h2 ref={heading} id={headingId} className="reply__eyebrow" tabIndex={-1}>{t.replyEyebrow}</h2>
          <button type="button" className="reply__close" onClick={() => snapTo("closed")} aria-label={t.replyCollapse}><CloseIcon /></button>
        </header>
        <ReplyScroll detail={detail} onScrolled={() => { if (!expanded) snapTo("full"); }} />
      </m.div>
    </div>,
    document.body,
  );
}
