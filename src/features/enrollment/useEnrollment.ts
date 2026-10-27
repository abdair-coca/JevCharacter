import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Language } from "../../stores/preferencesStore";
import { submitEnrollment } from "./enrollmentClient";
import { isEnrollmentIntent } from "./enrollmentIntent";
import { validateEnrollment, type EnrollmentErrors, type EnrollmentField, type EnrollmentFields } from "./validation";

type Phase = "closed" | "editing" | "confirmed" | "closing";
type Session = { phase: Phase; completed: boolean; fields: EnrollmentFields; errors: EnrollmentErrors; sending: boolean; failed: boolean };
const empty = (phase: Phase = "closed"): Session => ({
  phase, completed: phase === "confirmed", fields: { name: "", phone: "", consent: false }, errors: {}, sending: false, failed: false,
});
const FIELD_ORDER: EnrollmentField[] = ["name", "phone", "consent"];

/** UI session, independent of conversation and storage: the details leave only on confirm, to `api/enroll`. */
export function useEnrollment(active: boolean, closeDuration: number) {
  const [session, setSession] = useState<Session>(empty);
  const request = useRef<AbortController | null>(null);
  const cancelRequest = useCallback(() => {
    request.current?.abort();
    request.current = null;
  }, []);
  useLayoutEffect(() => {
    if (active) return;
    cancelRequest();
    setSession(current => current.phase === "closed" ? current : empty());
  }, [active, cancelRequest]);
  useEffect(() => cancelRequest, [cancelRequest]);
  useEffect(() => {
    if (session.phase !== "closing") return;
    const timer = window.setTimeout(() => setSession(empty()), closeDuration * 1000);
    return () => window.clearTimeout(timer);
  }, [session.phase, closeDuration]);
  const tryOpen = useCallback((message: string) => {
    if (!active || !isEnrollmentIntent(message)) return false;
    setSession(current => current.phase === "closed" ? empty("editing") : current);
    return true;
  }, [active]);
  const change = <F extends EnrollmentField>(field: F, value: EnrollmentFields[F]) => setSession(current => {
    if (current.phase !== "editing" || current.sending) return current;
    const fields = { ...current.fields, [field]: value };
    const errors = { ...current.errors };
    if (errors[field]) errors[field] = validateEnrollment(fields)[field];
    return { ...current, fields, errors };
  });
  const confirm = (language: Language): EnrollmentField | null => {
    if (session.phase !== "editing" || session.sending || !active) return null;
    const errors = validateEnrollment(session.fields);
    const invalid = FIELD_ORDER.find(field => errors[field]) ?? null;
    if (invalid) {
      setSession(current => current.phase !== "editing" ? current : { ...current, errors, failed: false });
      return invalid;
    }
    const controller = new AbortController();
    request.current = controller;
    setSession(current => current.phase !== "editing" ? current : { ...current, errors: {}, sending: true, failed: false });
    void submitEnrollment(session.fields, language, controller.signal).then(saved => {
      // Closing the form or leaving Home aborts the request, so its late answer changes nothing.
      if (controller.signal.aborted) return;
      request.current = null;
      setSession(current => current.phase !== "editing" ? current : saved ? empty("confirmed") : { ...current, sending: false, failed: true });
    });
    return null;
  };
  const close = useCallback(() => {
    cancelRequest();
    setSession(current => current.phase === "closed" ? current : { ...empty("closing"), completed: current.completed });
  }, [cancelRequest]);
  return { ...session, isOpen: session.phase !== "closed", tryOpen, change, confirm, close };
}
export type EnrollmentSession = ReturnType<typeof useEnrollment>;
