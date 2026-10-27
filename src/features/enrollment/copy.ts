import type { Language } from "../../stores/preferencesStore";

const es = {
  university: "Universidad Autónoma Tomás Frías", career: "Ingeniería Informática",
  eyebrow: "TU PRÓXIMO COMIENZO", title: "Tu futuro empieza", accent: "con una idea.",
  intro: "Demos el primer paso.", name: "Nombre completo", namePlaceholder: "¿Cómo te llamas?",
  phone: "Número de celular", phonePlaceholder: "Ej. 7123 4567", phoneHint: "Bolivia · 8 dígitos · +591 opcional",
  consent: "Acepto que la UATF me contacte con estos datos.",
  confirm: "Confirmar datos", sending: "Enviando…", close: "Cerrar inscripción",
  privacy: "Tus datos se envían a la UATF solo para contactarte sobre tu inscripción.",
  nameRequired: "Escribe tu nombre completo.", nameTooLong: "Usa hasta 120 caracteres.",
  phoneInvalid: "Escribe 8 dígitos. Puedes incluir +591.", consentRequired: "Marca la casilla para enviar tus datos.",
  sendFailed: "No pudimos enviar tus datos. Revisa tu conexión e inténtalo de nuevo.",
  success: "Datos enviados", successAccent: "Un gran comienzo.",
  successBody: "Recibimos tus datos. Te contactaremos a tu celular sobre tu inscripción.",
  back: "Volver a Jev", fallback: "Puedes continuar con tus datos.",
};
export const enrollmentCopy: Record<Language, Record<keyof typeof es, string>> = {
  es,
  en: {
    university: "Universidad Autónoma Tomás Frías", career: "Computer Engineering",
    eyebrow: "YOUR NEXT BEGINNING", title: "Your future starts", accent: "with an idea.",
    intro: "Let's take the first step.", name: "Full name", namePlaceholder: "What's your name?",
    phone: "Mobile number", phonePlaceholder: "E.g. 7123 4567", phoneHint: "Bolivia · 8 digits · optional +591",
    consent: "I agree that UATF may contact me with these details.",
    confirm: "Confirm details", sending: "Sending…", close: "Close enrollment",
    privacy: "Your details go to UATF only to contact you about your enrollment.",
    nameRequired: "Enter your full name.", nameTooLong: "Use up to 120 characters.",
    phoneInvalid: "Enter 8 digits. You can include +591.", consentRequired: "Check the box to send your details.",
    sendFailed: "We couldn't send your details. Check your connection and try again.",
    success: "Details sent", successAccent: "A great beginning.",
    successBody: "We received your details. We'll contact you on your mobile about your enrollment.",
    back: "Back to Jev", fallback: "You can continue with your details.",
  },
};
