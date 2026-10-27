import { useEffect, useRef } from "react";
import { m } from "motion/react";
import { Button } from "../../components/ui/button";
import { enrollmentCopy } from "./copy";
import type { EnrollmentSession } from "./useEnrollment";
import type { Language } from "../../stores/preferencesStore";
import { useEnrollmentMotion } from "./useEnrollmentMotion";

type Props = { session: EnrollmentSession; language: Language; characterFailed: boolean; onFieldFocus: (focused: boolean) => void };

// Only text fields open the mobile keyboard, so only they compact Jev.
const isTextField = (node: EventTarget | null) => node instanceof HTMLInputElement && node.type !== "checkbox";

export function EnrollmentExperience({ session, language, characterFailed, onFieldFocus }: Props) {
  const copy = enrollmentCopy[language];
  const motion = useEnrollmentMotion();
  const title = useRef<HTMLHeadingElement>(null);
  const container = useRef<HTMLElement>(null);
  const name = useRef<HTMLInputElement>(null);
  const phone = useRef<HTMLInputElement>(null);
  const consent = useRef<HTMLInputElement>(null);
  const pressing = useRef(false);
  const confirmed = session.completed;
  const sending = session.sending;
  const closing = session.phase === "closing";
  const close = session.close;
  useEffect(() => {
    // Focus the heading, not the input: opening the demo should not force a
    // mobile keyboard before the student has seen the composition.
    title.current?.focus({ preventScroll: true });
    if (container.current) container.current.scrollTop = 0;
  }, [confirmed]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [close]);
  useEffect(() => {
    // A press that blurred a field expands Jev only after its click has landed, unless it left focus in a text field.
    let frame = 0;
    const release = () => {
      if (!pressing.current) return;
      pressing.current = false;
      frame = requestAnimationFrame(() => { if (!isTextField(document.activeElement)) onFieldFocus(false); });
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [onFieldFocus]);

  return <m.section ref={container} className="enrollment" aria-labelledby="page-title" inert={closing} aria-hidden={closing}
    initial={{ opacity: 0, y: motion.reduced ? 0 : "var(--motion-distance-md)" }}
    animate={{ opacity: closing ? 0 : 1, y: closing && !motion.reduced ? "var(--motion-distance-sm)" : 0 }}
    transition={closing ? { duration: motion.close } : motion.scene}>
    <div className="enrollment__topline"><span>UATF <span aria-hidden="true">/</span> {copy.career}</span>
      <button type="button" className="enrollment__close" aria-label={copy.close} onClick={close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7" /></svg></button>
    </div>
    <div className="enrollment__body" data-confirmed={confirmed}>
      <p className="enrollment__eyebrow">{confirmed ? copy.success : copy.eyebrow}</p>
      <h2 ref={title} id="page-title" tabIndex={-1}>{confirmed ? copy.successAccent : <>{copy.title}<br /><em>{copy.accent}</em></>}</h2>
      {confirmed ? <m.div className="enrollment__success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={motion.ui}>
        <span className="enrollment__check" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m8 16 5 5 11-11" /></svg></span>
        <p role="status">{copy.successBody}</p>
        <Button type="button" className="enrollment__submit" onClick={close}>{copy.back}<span className="ui-button__arrow" aria-hidden="true">↗</span></Button>
      </m.div> : <>
        <p className="enrollment__intro">{copy.intro}</p>
        <form noValidate autoComplete="off" onSubmit={event => {
          event.preventDefault();
          const invalid = session.confirm(language);
          if (invalid) ({ name, phone, consent })[invalid].current?.focus();
          else onFieldFocus(false);
        }} onFocusCapture={event => { if (isTextField(event.target)) onFieldFocus(true); }}
          onPointerDownCapture={() => { pressing.current = true; }}
          onBlurCapture={event => {
            // Keep geometry stable through pointerdown → blur → pointerup on
            // Confirm/Close or the consent label. Expanding on blur would move the tapped control.
            if (pressing.current) return;
            if (!(event.relatedTarget instanceof Node) || !container.current?.contains(event.relatedTarget)) onFieldFocus(false);
          }}>
          <div className="enrollment__field">
            <label htmlFor="enrollment-name">{copy.name}</label>
            <input ref={name} id="enrollment-name" value={session.fields.name} readOnly={sending} onChange={event => session.change("name", event.target.value)}
              type="text" autoComplete="off" maxLength={120} required placeholder={copy.namePlaceholder}
              aria-invalid={Boolean(session.errors.name)} aria-describedby={session.errors.name ? "enrollment-name-error" : undefined} />
            {session.errors.name && <p className="enrollment__error" id="enrollment-name-error" role="alert">{copy[session.errors.name]}</p>}
          </div>
          <div className="enrollment__field">
            <label htmlFor="enrollment-phone">{copy.phone}</label>
            <input ref={phone} id="enrollment-phone" value={session.fields.phone} readOnly={sending} onChange={event => session.change("phone", event.target.value)}
              type="tel" inputMode="tel" autoComplete="off" maxLength={24} required placeholder={copy.phonePlaceholder}
              aria-invalid={Boolean(session.errors.phone)} aria-describedby={session.errors.phone ? "enrollment-phone-error" : "enrollment-phone-hint"} />
            {session.errors.phone ? <p className="enrollment__error" id="enrollment-phone-error" role="alert">{copy[session.errors.phone]}</p> : <p className="enrollment__hint" id="enrollment-phone-hint">{copy.phoneHint}</p>}
          </div>
          <div className="enrollment__consent">
            <input ref={consent} id="enrollment-consent" type="checkbox" checked={session.fields.consent} onChange={event => session.change("consent", event.target.checked)}
              aria-invalid={Boolean(session.errors.consent)} aria-describedby={session.errors.consent ? "enrollment-consent-error" : undefined} />
            <label htmlFor="enrollment-consent">{copy.consent}</label>
            {session.errors.consent && <p className="enrollment__error" id="enrollment-consent-error" role="alert">{copy[session.errors.consent]}</p>}
          </div>
          {session.failed && <p className="enrollment__error enrollment__failed" role="alert">{copy.sendFailed}</p>}
          {/* aria-disabled, not disabled: the button keeps focus while the details travel. */}
          <Button type="submit" className="enrollment__submit" aria-disabled={sending} aria-busy={sending}>{sending ? copy.sending : copy.confirm}<span className="ui-button__arrow" aria-hidden="true">↗</span></Button>
        </form>
      </>}
      {characterFailed && <p className="enrollment__hint" role="status">{copy.fallback}</p>}
      <p className="enrollment__privacy">{copy.privacy}</p>
    </div>
    <p className="enrollment__university">{copy.university}</p>
  </m.section>;
}
