import type { Language } from "../../stores/preferencesStore";

const es = {
  university: "Universidad Autónoma Tomás Frías", career: "Ingeniería Informática",
  eyebrow: "TU PRÓXIMO COMIENZO", title: "Tu futuro empieza", accent: "con una idea.",
  intro: "Demos el primer paso.", name: "Nombre completo", namePlaceholder: "¿Cómo te llamas?",
  phone: "Número de celular", phonePlaceholder: "Ej. 7123 4567", phoneHint: "Bolivia · 8 dígitos · +591 opcional",
  confirm: "Confirmar datos", close: "Cerrar inscripción", demo: "Demo visual · sin envío de datos",
  nameRequired: "Escribe tu nombre completo.", nameTooLong: "Usa hasta 120 caracteres.",
  phoneInvalid: "Escribe 8 dígitos. Puedes incluir +591.",
  success: "Datos completados", successAccent: "Un gran comienzo.",
  successBody: "Completaste la demostración. Tu próximo paso empieza contigo.",
  back: "Volver a Jev", fallback: "Puedes continuar con tus datos.",
};
export const enrollmentCopy: Record<Language, Record<keyof typeof es, string>> = {
  es,
  en: {
    university: "Universidad Autónoma Tomás Frías", career: "Computer Engineering",
    eyebrow: "YOUR NEXT BEGINNING", title: "Your future starts", accent: "with an idea.",
    intro: "Let's take the first step.", name: "Full name", namePlaceholder: "What's your name?",
    phone: "Mobile number", phonePlaceholder: "E.g. 7123 4567", phoneHint: "Bolivia · 8 digits · optional +591",
    confirm: "Confirm details", close: "Close enrollment", demo: "Visual demo · no data sent",
    nameRequired: "Enter your full name.", nameTooLong: "Use up to 120 characters.",
    phoneInvalid: "Enter 8 digits. You can include +591.",
    success: "Details completed", successAccent: "A great beginning.",
    successBody: "You completed the demo. Your next step starts with you.",
    back: "Back to Jev", fallback: "You can continue with your details.",
  },
};
