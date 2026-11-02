import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { m } from "motion/react";
import { clearMemory, importBrowserMemory, reloadAccountMemory, removeMemory, useMemory, type MemoryNote } from "../../creature/memory/memoryStore";
import { useTranslation } from "../../i18n/useTranslation";
import { useUiMotion } from "../../lib/motionTokens";
import { usePreferences } from "../../stores/preferencesStore";
import { signIn, useAccount } from "../account/accountStore";
import { CloseIcon } from "../reply/SpeechReply";
import "./memory.css";

// Loaded only when the panel opens.

const FOCUSABLE = "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])";
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31_536_000], ["month", 2_592_000], ["day", 86_400], ["hour", 3_600], ["minute", 60]];

function relativeTime(createdAt: number, now: number, language: string) {
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const seconds = Math.round((createdAt - now) / 1000);
  const unit = UNITS.find(([, size]) => Math.abs(seconds) >= size);
  return unit ? format.format(Math.round(seconds / unit[1]), unit[0]) : format.format(0, "second");
}

function ForgetIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
}

const newestFirst = (notes: MemoryNote[]) => [...notes].reverse();
// «Not now» to moving this browser's notes into the account holds until the next visit.
let importDeclined = false;

/** «What Jev remembers»: every note, from this browser or the account, with forget one and forget all. Modal over Home. */
export default function MemoryPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslation();
  const language = usePreferences(state => state.language);
  const transition = useUiMotion();
  const headingId = useId();
  const panel = useRef<HTMLDivElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const memory = useMemory();
  const account = useAccount();
  const notes = useMemo(() => newestFirst(memory.notes), [memory.notes]);
  const [confirming, setConfirming] = useState(false);
  const [declined, setDeclined] = useState(importDeclined);
  const [importing, setImporting] = useState(false);
  const [importFailed, setImportFailed] = useState(false);
  const [now] = useState(Date.now);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  // Opening the panel brings in what other devices kept or forgot.
  useEffect(() => { reloadAccountMemory(); }, []);
  useEffect(() => { if (confirming) cancel.current?.focus({ preventScroll: true }); }, [confirming]);

  // After forgetting a note, focus stays in the list: on the next note, else on the title.
  const forget = (id: string, index: number) => {
    const remaining = removeMemory(id).length;
    requestAnimationFrame(() => {
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>(".memory-note__forget");
      (buttons?.[Math.min(index, remaining - 1)] ?? heading.current)?.focus({ preventScroll: true });
    });
  };

  const forgetAll = () => {
    clearMemory();
    setConfirming(false);
    heading.current?.focus({ preventScroll: true });
  };

  // Either answer removes the offer, so focus returns to the title.
  const moveNotes = async () => {
    setImporting(true);
    setImportFailed(false);
    const moved = await importBrowserMemory();
    setImporting(false);
    setImportFailed(!moved);
    if (moved) heading.current?.focus({ preventScroll: true });
  };

  const decline = () => {
    importDeclined = true;
    setDeclined(true);
    heading.current?.focus({ preventScroll: true });
  };

  const where = memory.source === "browser" ? t.memoryLocal
    : memory.status === "loading" ? t.memoryLoading
      : memory.status === "offline" ? t.memoryOffline : t.memoryAccount;
  const offerImport = memory.source === "account" && memory.status === "ready" && memory.browserNotes > 0 && !declined;

  // Keys stay inside the modal: Home's shortcuts must not act behind it.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      if (confirming) setConfirming(false);
      else onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
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

  // Portalled above the page like the reply sheet; a click on it never reaches Jev's stage.
  return createPortal(
    <div className="memory-layer" onPointerDown={event => event.stopPropagation()}>
      <m.div className="memory__backdrop" onClick={onClose} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition} />
      <m.div ref={panel} className="memory" role="dialog" aria-modal="true" aria-labelledby={headingId} lang={language} onKeyDown={onKeyDown}
        initial={{ opacity: 0, y: "var(--motion-distance-md)" }} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <header className="memory__head">
          <h2 ref={heading} id={headingId} tabIndex={-1}>{t.memoryTitle}</h2>
          <button type="button" className="reply__close" onClick={onClose} aria-label={t.memoryClose}><CloseIcon /></button>
        </header>
        <p className={memory.status === "offline" ? "memory__local memory__local--offline" : "memory__local"} role="status">{where}</p>
        {memory.source === "browser" && account.status !== "unavailable" && (
          <div className="memory__account">
            <button type="button" className="memory__sign-in" disabled={account.status === "connecting"} onClick={() => void signIn()}>
              {account.status === "connecting" ? t.accountConnecting : t.accountSignIn}
            </button>
            {account.failed && <p className="memory__error" role="alert">{t.accountFailed}</p>}
          </div>
        )}
        {offerImport && (
          <div className="memory__offer">
            <p>{t.memoryImportAsk}</p>
            {importFailed && <p className="memory__error" role="alert">{t.memoryImportFailed}</p>}
            <div>
              <button type="button" onClick={decline}>{t.memoryImportLater}</button>
              <button type="button" className="memory__primary" disabled={importing} onClick={() => void moveNotes()}>
                {memory.browserNotes === 1 ? t.memoryImportOne : t.memoryImportMany.replace("{count}", String(memory.browserNotes))}
              </button>
            </div>
          </div>
        )}
        {notes.length === 0
          ? memory.status !== "loading" && <p className="memory__empty">{t.memoryEmpty}</p>
          : (
            <ul className="memory__list">
              {notes.map((note, index) => (
                <li key={note.id} className="memory-note">
                  <p>{note.text}<time dateTime={new Date(note.createdAt).toISOString()}>{relativeTime(note.createdAt, now, language)}</time></p>
                  <button type="button" className="memory-note__forget" onClick={() => forget(note.id, index)} aria-label={`${t.memoryForget}: ${note.text}`}><ForgetIcon /></button>
                </li>
              ))}
            </ul>
          )}
        {notes.length > 0 && (confirming
          ? (
            <div className="memory__confirm">
              <p>{t.memoryConfirm}</p>
              <div>
                <button ref={cancel} type="button" onClick={() => setConfirming(false)}>{t.memoryCancel}</button>
                <button type="button" className="memory__danger" onClick={forgetAll}>{t.memoryForgetAll}</button>
              </div>
            </div>
          )
          : <button type="button" className="memory__forget-all" onClick={() => setConfirming(true)}>{t.memoryForgetAll}</button>)}
      </m.div>
    </div>,
    document.body,
  );
}
