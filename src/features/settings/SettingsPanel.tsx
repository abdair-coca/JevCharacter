import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { m } from "motion/react";
import { Button } from "../../components/ui/button";
import { JEV_COLOR_IDS } from "../../character/jevColors";
import { clearGroqKey, readGroqKey, saveGroqKey } from "../../creature/brain/groqKeyStore";
import { useTranslation } from "../../i18n/useTranslation";
import { appAudio } from "../../lib/audioCore";
import { useUiMotion } from "../../lib/motionTokens";
import { usePreferences } from "../../stores/preferencesStore";
import { CloseIcon } from "../reply/SpeechReply";
import "./settings.css";

// Loaded only when the settings open.

const FOCUSABLE = "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])";

type Props = {
  onClose: () => void;
  /** Swaps Ajustes for «What Jev remembers». */
  onOpenMemory: () => void;
  /** Home's live-signal panel; absent on views that have no signals to show. */
  diagnostics?: { active: boolean; onToggle: () => void };
};

/** Ajustes: Jev's sound, color, memory and diagnostics, the interface language and the visitor's own Groq key. Modal over the page. */
export default function SettingsPanel({ onClose, onOpenMemory, diagnostics }: Props) {
  const t = useTranslation();
  const language = usePreferences(state => state.language);
  const setLanguage = usePreferences(state => state.setLanguage);
  const sound = usePreferences(state => state.sound);
  const setSound = usePreferences(state => state.setSound);
  const jevColor = usePreferences(state => state.jevColor);
  const setJevColor = usePreferences(state => state.setJevColor);
  const transition = useUiMotion();
  const headingId = useId();
  const jevTitleId = useId();
  const keyTitleId = useId();
  const keyInputId = useId();
  const keyHelpId = useId();
  const keyErrorId = useId();
  const panel = useRef<HTMLDivElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const keyInput = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const [keyStored, setKeyStored] = useState(() => readGroqKey() !== null);
  const [keyRejected, setKeyRejected] = useState(false);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  const toggleSound = () => {
    setSound(!sound);
    if (sound) return;
    // Turning sound on is itself a gesture, so audio can start right away.
    appAudio.setEnabled(true);
    appAudio.unlock();
  };

  const saveKey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!saveGroqKey(draft)) {
      setKeyRejected(true);
      return;
    }
    // The key leaves the field as soon as it is saved. The save button turns disabled and would drop
    // focus, so focus moves to the field: Escape keeps working from inside the dialog.
    setDraft("");
    setKeyRejected(false);
    setKeyStored(true);
    requestAnimationFrame(() => keyInput.current?.focus({ preventScroll: true }));
  };

  const removeKey = () => {
    clearGroqKey();
    setKeyStored(false);
    requestAnimationFrame(() => keyInput.current?.focus({ preventScroll: true }));
  };

  // Keys stay inside the modal: Home's shortcuts must not act behind it.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
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

  // Portalled above the page like the memory panel; a click on it never reaches Jev's stage.
  return createPortal(
    <div className="settings-layer" onPointerDown={event => event.stopPropagation()}>
      <m.div className="settings__backdrop" onClick={onClose} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition} />
      <m.div ref={panel} className="settings" role="dialog" aria-modal="true" aria-labelledby={headingId} lang={language} onKeyDown={onKeyDown}
        initial={{ opacity: 0, y: "var(--motion-distance-md)" }} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <header className="settings__head">
          <h2 ref={heading} id={headingId} tabIndex={-1}>{t.settingsTitle}</h2>
          <button type="button" className="reply__close" onClick={onClose} aria-label={t.settingsClose}><CloseIcon /></button>
        </header>

        <button type="button" className="settings__switch" aria-pressed={sound} onClick={toggleSound}>
          <span>{t.sound}</span>
          <span className="settings__track" aria-hidden="true" />
        </button>

        <div className="settings__row settings__row--colors">
          <span className="settings__label">{t.jevColor}</span>
          <div className="settings__swatches" role="group" aria-label={t.jevColor}>
            {JEV_COLOR_IDS.map(id => (
              <button key={id} type="button" className="settings__swatch" data-color={id} aria-pressed={jevColor === id} aria-label={t[id]} title={t[id]} onClick={() => setJevColor(id)} />
            ))}
          </div>
        </div>

        <div className="settings__row">
          <span className="settings__label">{t.language}</span>
          <div className="language-switch" data-language={language} role="group" aria-label={t.language}>
            <m.span className="language-switch__indicator" aria-hidden="true" initial={false} animate={{ x: language === "en" ? "100%" : "0%" }} transition={transition} />
            <Button variant="ghost" size="small" aria-pressed={language === "es"} aria-label="Español" onClick={() => setLanguage("es")}>ES</Button>
            <Button variant="ghost" size="small" aria-pressed={language === "en"} aria-label="English" onClick={() => setLanguage("en")}>EN</Button>
          </div>
        </div>

        <section className="settings__group" aria-labelledby={jevTitleId}>
          <h3 id={jevTitleId}>{t.settingsJev}</h3>
          <button type="button" className="settings__link" aria-haspopup="dialog" onClick={onOpenMemory}>
            <span>{t.memory}</span><span aria-hidden="true">›</span>
          </button>
          {diagnostics && (
            <button type="button" className="settings__link" aria-pressed={diagnostics.active} onClick={diagnostics.onToggle}>
              <span>{t.diagnostics}</span><span aria-hidden="true">›</span>
            </button>
          )}
        </section>

        <section className="settings__group" aria-labelledby={keyTitleId}>
          <h3 id={keyTitleId}>{t.groqTitle}</h3>
          <p id={keyHelpId} className="settings__help">{t.groqHelp}</p>
          <p className="settings__status" role="status">{keyStored ? t.groqSaved : t.groqMissing}</p>
          <form className="settings__key" onSubmit={saveKey}>
            <label htmlFor={keyInputId}>{t.groqLabel}</label>
            <input id={keyInputId} ref={keyInput} type="password" value={draft} placeholder="gsk_…" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              aria-invalid={keyRejected} aria-describedby={keyRejected ? keyErrorId : keyHelpId}
              onChange={event => { setDraft(event.target.value); setKeyRejected(false); }} />
            {keyRejected && <p id={keyErrorId} className="settings__error">{t.groqInvalid}</p>}
            <div className="settings__actions">
              <button type="submit" disabled={!draft.trim()}>{t.groqSave}</button>
              {keyStored && <button type="button" onClick={removeKey}>{t.groqRemove}</button>}
            </div>
          </form>
        </section>
      </m.div>
    </div>,
    document.body,
  );
}
