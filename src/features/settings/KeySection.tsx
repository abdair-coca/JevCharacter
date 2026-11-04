import { useId, useRef, useState, type FormEvent } from "react";
import type { KeyStore } from "../../creature/brain/keyStore";
import { useTranslation } from "../../i18n/useTranslation";

type Provider = "groq" | "gemini";

type Props = {
  provider: Provider;
  store: KeyStore;
  /** Where the visitor creates the key. */
  keysUrl: string;
  placeholder: string;
  /** Shown instead of the saved state while the provider is refusing the saved key. */
  problem?: string | null;
  /** Fixed notes under the help, such as how the provider uses what it receives. */
  notes?: string[];
  onSaved?: () => void;
};

/** One provider key the visitor keeps in this browser: help, a guide, its state and the field to save or remove it. */
export function KeySection({ provider, store, keysUrl, placeholder, problem, notes = [], onSaved }: Props) {
  const t = useTranslation();
  const titleId = useId();
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const [stored, setStored] = useState(() => store.read() !== null);
  const [rejected, setRejected] = useState(false);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!store.save(draft)) {
      setRejected(true);
      return;
    }
    // The key leaves the field as soon as it is saved. The save button turns disabled and would drop
    // focus, so focus moves to the field: Escape keeps working from inside the dialog.
    setDraft("");
    setRejected(false);
    setStored(true);
    onSaved?.();
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  };

  const remove = () => {
    store.clear();
    setStored(false);
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  };

  return (
    <section className="settings__group" aria-labelledby={titleId}>
      <h3 id={titleId}>{t[`${provider}Title`]}</h3>
      <p id={helpId} className="settings__help">{t[`${provider}Help`]}</p>
      {notes.map(note => <p key={note} className="settings__help">{note}</p>)}
      <details className="settings__guide">
        <summary className="settings__link"><span>{t[`${provider}Guide`]}</span><span aria-hidden="true">›</span></summary>
        <ol>
          <li>
            <a href={keysUrl} target="_blank" rel="noopener noreferrer">{t[`${provider}StepConsole`]}<span className="sr-only"> {t.newTab}</span><span aria-hidden="true"> ↗</span></a> {t[`${provider}StepSignIn`]}
          </li>
          <li>{t[`${provider}StepCreate`]}</li>
          <li>{t[`${provider}StepCopy`]}</li>
          <li>{t[`${provider}StepPaste`]}</li>
        </ol>
      </details>
      <p className="settings__status" role="status">{stored ? problem ?? t[`${provider}Saved`] : t[`${provider}Missing`]}</p>
      <form className="settings__key" onSubmit={save}>
        <label htmlFor={inputId}>{t[`${provider}Label`]}</label>
        <input id={inputId} ref={input} type="password" value={draft} placeholder={placeholder} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-invalid={rejected} aria-describedby={rejected ? errorId : helpId}
          onChange={event => { setDraft(event.target.value); setRejected(false); }} />
        {rejected && <p id={errorId} className="settings__error">{t[`${provider}Invalid`]}</p>}
        <div className="settings__actions">
          <button type="submit" disabled={!draft.trim()}>{t[`${provider}Save`]}</button>
          {stored && <button type="button" onClick={remove}>{t[`${provider}Remove`]}</button>}
        </div>
      </form>
    </section>
  );
}
