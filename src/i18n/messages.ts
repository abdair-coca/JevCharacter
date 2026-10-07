import type { Language } from "../stores/preferencesStore";

const es = {
  home: "Inicio", features: "Capacidades", about: "Historia", navigation: "Navegación principal",
  skip: "Ir al contenido", theme: "Tema", system: "Sistema", light: "Claro", dark: "Oscuro",
  language: "Idioma", title: "Pequeña criatura.", titleAccent: "Grandes decisiones.",
  intro: "Mueve el cursor. Acércate. Dile algo.", creature: "Jev, tu criatura digital interactiva",
  input: "Dale contexto a Jev", placeholder: "¿Qué quieres contarle a Jev?", send: "Enviar a Jev",
  inputHelp: "Lo que le cuentas cambia cómo reacciona.", clear: "Borrar conversación", contextHeld: "Contexto en sesión",
  speechUnavailable: "El habla no está disponible. Inténtalo de nuevo.",
  speechRegenerating: "Generando de nuevo en español…",
  speechInterrupted: "Respuesta interrumpida. Puedes enviar tu mensaje de nuevo.",
  decisionInterrupted: "Decisión interrumpida. Puedes enviar tu mensaje de nuevo.",
  received: "Contexto enviado", confidence: "Confianza", deciding: "Decidiendo", observing: "Observando",
  local: "Instinto local", online: "Decisión de Jev", details: "Detalles de la decisión",
  probabilities: "Probabilidades de reacción", intensity: "Intensidad", attention: "Atención",
  calm: "Calma", engaged: "Activo", intense: "Intenso", energy: "Energía", trust: "Confianza", curiosity: "Curiosidad",
  reaction: "Reacción", answer: "Respuesta", talk: "Habla", morph: "Transformación", decision: "Decisión",
  BASE: "Observa", HELLO: "Saluda", GHOST: "Se asusta", FLOWER: "Florece", CLOUD: "Nube",
  YES: "Sí", NO: "No", STAR: "Estrella", SQUARE: "Cuadrado", TRIANGLE: "Triángulo",
  pending: "Esta vista se construirá en una próxima fase.", backHome: "Volver a Jev", notFound: "Página no encontrada",
  footer: "Una interfaz con personalidad.", diagnostics: "Diagnóstico", close: "Cerrar diagnóstico",
  debugSignal: "Señales en vivo", distance: "Distancia", speed: "Velocidad", near: "Cerca", idle: "Inactividad",
  clicks: "Toques", absence: "Ausencia", source: "Origen", latency: "Latencia", reactionConfidence: "Confianza de reacción",
} satisfies Record<string, string>;

export type MessageKey = keyof typeof es;
const en: Record<MessageKey, string> = {
  home: "Home", features: "Features", about: "About", navigation: "Main navigation",
  skip: "Skip to content", theme: "Theme", system: "System", light: "Light", dark: "Dark",
  language: "Language", title: "Tiny creature.", titleAccent: "Big decisions.",
  intro: "Move your cursor. Come closer. Say something.", creature: "Jev, your interactive digital creature",
  input: "Give Jev context", placeholder: "What would you like to tell Jev?", send: "Send to Jev",
  inputHelp: "What you share changes how it reacts.", clear: "Clear conversation", contextHeld: "Session context",
  speechUnavailable: "Speech is unavailable. Please try again.",
  speechRegenerating: "Generating again in English…",
  speechInterrupted: "Reply interrupted. You can send your message again.",
  decisionInterrupted: "Decision interrupted. You can send your message again.",
  received: "Context sent", confidence: "Confidence", deciding: "Deciding", observing: "Observing",
  local: "Local instinct", online: "Jev decision", details: "Decision details",
  probabilities: "Reaction probabilities", intensity: "Intensity", attention: "Attention",
  calm: "Calm", engaged: "Engaged", intense: "Intense", energy: "Energy", trust: "Trust", curiosity: "Curiosity",
  reaction: "Reaction", answer: "Answer", talk: "Talk", morph: "Transformation", decision: "Decision",
  BASE: "Observes", HELLO: "Waves", GHOST: "Gets scared", FLOWER: "Blooms", CLOUD: "Cloud",
  YES: "Yes", NO: "No", STAR: "Star", SQUARE: "Square", TRIANGLE: "Triangle",
  pending: "This view will be built in an upcoming phase.", backHome: "Back to Jev", notFound: "Page not found",
  footer: "An interface with personality.", diagnostics: "Diagnostics", close: "Close diagnostics",
  debugSignal: "Live signals", distance: "Distance", speed: "Speed", near: "Nearby", idle: "Idle",
  clicks: "Clicks", absence: "Absence", source: "Source", latency: "Latency", reactionConfidence: "Reaction confidence",
};

export const messages: Record<Language, Record<MessageKey, string>> = { es, en };
