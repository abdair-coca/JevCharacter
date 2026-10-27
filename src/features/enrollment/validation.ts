export type EnrollmentFields = { name: string; phone: string; consent: boolean };
export type EnrollmentField = keyof EnrollmentFields;
export type EnrollmentError = "nameRequired" | "nameTooLong" | "phoneInvalid" | "consentRequired";
export type EnrollmentErrors = Partial<Record<EnrollmentField, EnrollmentError>>;

export function normalizePhone(value: string): string | null {
  const compact = value.replace(/[\s-]/g, "");
  return /^(?:\+591)?\d{8}$/.test(compact) ? compact.replace(/^\+591/, "") : null;
}

/** Shared by the form and `api/enroll.ts`, so both accept exactly the same details. */
export function validateEnrollment(fields: EnrollmentFields): EnrollmentErrors {
  const errors: EnrollmentErrors = {};
  if (!fields.name.trim()) errors.name = "nameRequired";
  else if (fields.name.trim().length > 120) errors.name = "nameTooLong";
  if (!normalizePhone(fields.phone)) errors.phone = "phoneInvalid";
  if (!fields.consent) errors.consent = "consentRequired";
  return errors;
}
