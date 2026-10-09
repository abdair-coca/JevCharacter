export type EnrollmentFields = { name: string; phone: string };
export type EnrollmentField = keyof EnrollmentFields;
export type EnrollmentError = "nameRequired" | "nameTooLong" | "phoneInvalid";
export type EnrollmentErrors = Partial<Record<EnrollmentField, EnrollmentError>>;

export function normalizePhone(value: string): string | null {
  const compact = value.replace(/[\s-]/g, "");
  return /^(?:\+591)?\d{8}$/.test(compact) ? compact.replace(/^\+591/, "") : null;
}

export function validateEnrollment(fields: EnrollmentFields): EnrollmentErrors {
  const errors: EnrollmentErrors = {};
  if (!fields.name.trim()) errors.name = "nameRequired";
  else if (fields.name.trim().length > 120) errors.name = "nameTooLong";
  if (!normalizePhone(fields.phone)) errors.phone = "phoneInvalid";
  return errors;
}
