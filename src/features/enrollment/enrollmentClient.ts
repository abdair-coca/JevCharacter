import type { Language } from "../../stores/preferencesStore";
import type { EnrollmentFields } from "./validation";

/** Sends one enrollment to `api/enroll.ts`; true once Supabase has saved it. */
export async function submitEnrollment(fields: EnrollmentFields, language: Language, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, language }),
      signal,
    });
    return response.ok;
  } catch {
    return false;
  }
}
