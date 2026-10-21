import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { animate, m, useDragControls, useMotionValue, useTransform, type PanInfo } from "motion/react";
import type { SpeechDetail } from "../../hooks/useSpeechSession";
import { useTranslation } from "../../i18n/useTranslation";
import { useUiMotion } from "../../lib/motionTokens";
import { CloseIcon, ReplyScroll, type Ask } from "./SpeechReply";

// Loaded only when the sheet opens: drag and imperative animation stay out of Home's first bundle.

const FOCUSABLE = "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])";

type Snap = "full" | "half" | "closed";

/** Mobile: bottom sheet with two heights; dragging it down returns to the preview. */
export default function ReplySheet({ detail, onCollapse, onAsk }: { detail: SpeechDetail; onCollapse: () => void; onAsk?: Ask }) {
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
        <ReplyScroll detail={detail} onAsk={onAsk} onScrolled={() => { if (!expanded) snapTo("full"); }} />
      </m.div>
    </div>,
    document.body,
  );
}
