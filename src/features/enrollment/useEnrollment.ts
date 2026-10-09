import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { isEnrollmentIntent } from "./enrollmentIntent";
import { validateEnrollment, type EnrollmentErrors, type EnrollmentField, type EnrollmentFields } from "./validation";

type Phase = "closed" | "editing" | "confirmed" | "closing";
type Session = { phase: Phase; completed: boolean; fields: EnrollmentFields; errors: EnrollmentErrors };
const empty = (phase: Phase = "closed"): Session => ({ phase, completed: phase === "confirmed", fields: { name: "", phone: "" }, errors: {} });

/** Ephemeral UI session, deliberately independent of conversation and storage. */
export function useEnrollment(active: boolean, closeDuration: number) {
  const [session, setSession] = useState<Session>(empty);
  useLayoutEffect(() => {
    if (!active) setSession(current => current.phase === "closed" ? current : empty());
  }, [active]);
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
  const change = (field: EnrollmentField, value: string) => setSession(current => {
    if (current.phase !== "editing") return current;
    const fields = { ...current.fields, [field]: value };
    const errors = { ...current.errors };
    if (errors[field]) errors[field] = validateEnrollment(fields)[field];
    return { ...current, fields, errors };
  });
  const confirm = (): EnrollmentField | null => {
    if (session.phase !== "editing" || !active) return null;
    const errors = validateEnrollment(session.fields);
    const invalid = errors.name ? "name" : errors.phone ? "phone" : null;
    setSession(current => current.phase !== "editing" ? current : invalid ? { ...current, errors } : empty("confirmed"));
    return invalid;
  };
  const close = useCallback(() => setSession(current => current.phase === "closed" ? current : { ...empty("closing"), completed: current.completed }), []);
  return { ...session, isOpen: session.phase !== "closed", tryOpen, change, confirm, close };
}
export type EnrollmentSession = ReturnType<typeof useEnrollment>;
