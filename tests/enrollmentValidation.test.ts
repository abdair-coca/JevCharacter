import { describe, expect, it } from "vitest";
import { isEnrollmentIntent } from "../src/features/enrollment/enrollmentIntent";
import { normalizePhone, validateEnrollment } from "../src/features/enrollment/validation";

describe("local enrollment intent", () => {
  it.each([
    "quiero inscribirme", "¡QUIERO INSCRIBIRME!", "Jev, me gustaría registrarme.",
    "quiero estudiar informática", "Me interesa la carrera", "Quisiera inscribirme en la UATF",
    "I want to sign up", "I'd like to register", "Sign me up!", "I'm interested in computer engineering",
  ])("opens the demo for %s", message => expect(isEnrollmentIntent(message)).toBe(true));
  it.each([
    "No quiero inscribirme", "No sé si quiero inscribirme", "I don't want to register", "I do not want to sign up",
    "Quiero registrarme en GitHub", "Quiero inscribirme en un gimnasio", "I want to register for Amazon",
    "Quiero estudiar medicina", "hola", "Háblame de informática", "mi celular es 71234567", "",
  ])("leaves unrelated/negative messages alone: %s", message => expect(isEnrollmentIntent(message)).toBe(false));
});

describe("enrollment validation", () => {
  it.each(["71234567", "+59171234567", "+591 7123-4567", " 7123 4567 "])("accepts a formatted Bolivian mobile: %s", value => {
    expect(normalizePhone(value)).toBe("71234567");
    expect(validateEnrollment({ name: "María José de la Cruz", phone: value })).toEqual({});
  });
  it.each(["", "1234567", "123456789", "+34 71234567", "59171234567", "7123abcd", "7123+4567", "(71234567)"])("rejects invalid phone: %s", value => expect(normalizePhone(value)).toBeNull());
  it("requires a name without assuming an alphabet or number of surnames", () => {
    expect(validateEnrollment({ name: "  ", phone: "71234567" })).toEqual({ name: "nameRequired" });
    expect(validateEnrollment({ name: "王小明", phone: "71234567" })).toEqual({});
    expect(validateEnrollment({ name: "x".repeat(121), phone: "71234567" })).toEqual({ name: "nameTooLong" });
  });
});
