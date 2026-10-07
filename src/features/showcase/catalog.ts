import type { CharacterState } from "../../character/useCharacterController";
import type { MorphForm } from "../../creature/brain/brain.types";
import type { Language } from "../../stores/preferencesStore";

export type Localized = Record<Language, string>;
export const SHOWCASE_TIMING_TOKENS = {
  prepare: "--showcase-prepare", ready: "--showcase-ready-timeout", observe: "--showcase-observe",
  reaction: "--showcase-reaction", think: "--showcase-think", answer: "--showcase-answer",
  talk: "--showcase-talk", morph: "--showcase-morph",
} as const;
export type ShowcaseTimings = Record<keyof typeof SHOWCASE_TIMING_TOKENS, number>;
export type DemoAction = { kind: "state"; state: CharacterState | "think" } | { kind: "morph"; form: MorphForm };
export type DemoStep = {
  action: DemoAction;
  duration: Exclude<keyof ShowcaseTimings, "prepare" | "ready">;
  caption: Localized;
  cursor?: { x: number; y: number };
};
type Chapter = {
  id: string; title: Localized; description: Localized; scenario: Localized;
  explanation: Localized; steps: readonly DemoStep[];
};
const text = (es: string, en: string): Localized => ({ es, en });
const state = (value: CharacterState | "think"): DemoAction => ({ kind: "state", state: value });

// Scripted examples, never readings from Home. No clock, sensors, randomness or services.
export const CHAPTERS = [
  {
    id: "perceives", title: text("Percibe", "Perceives"),
    description: text("Un pequeño movimiento. Toda su atención.", "A small movement. All its attention."),
    scenario: text("Un cursor recorre el escenario.", "A cursor moves across the scene."),
    explanation: text("Recorrido de cursor ilustrativo, no un sensor. El seguimiento interactivo del personaje se prueba en Inicio.", "Illustrative cursor path, not a sensor. Try the character's interactive tracking on Home."),
    steps: [
      { action: state("Base"), duration: "observe", caption: text("El cursor de ejemplo se acerca.", "The example cursor approaches."), cursor: { x: 0.25, y: 0.45 } },
      { action: state("Base"), duration: "observe", caption: text("La escena representa atención al movimiento.", "The scene illustrates attention to movement."), cursor: { x: 0.75, y: 0.55 } },
    ],
  },
  {
    id: "reacts", title: text("Reacciona", "Reacts"),
    description: text("No todo se responde con palabras.", "Not every response needs words."),
    scenario: text("Un saludo. Una sorpresa. Una reacción.", "A greeting. A surprise. A reaction."),
    explanation: text("Estados Hello, Flower y Ghost disponibles en el controlador actual.", "Hello, Flower and Ghost states are available in the current controller."),
    steps: [
      { action: state("Hello"), duration: "reaction", caption: text("Un saludo para empezar.", "A wave to begin." ) },
      { action: state("Flower"), duration: "reaction", caption: text("Una reacción que florece.", "A reaction that blooms." ) },
      { action: state("Ghost"), duration: "reaction", caption: text("Y una sorpresa inesperada.", "And an unexpected surprise." ) },
    ],
  },
  {
    id: "decides", title: text("Decide", "Decides"),
    description: text("Una situación. Una pequeña decisión.", "One situation. One small decision."),
    scenario: text("«Hola, Jev». Acción fijada: saludar.", "“Hi, Jev.” Scripted action: wave."),
    explanation: text("Ejemplo de HUD: reaction / HELLO, confianza 94 %, intensidad 0,6 y atención 65 %. Datos fijos, sin IA.", "Example HUD: reaction / HELLO, 94% confidence, 0.6 intensity and 65% attention. Fixed data, no AI."),
    steps: [
      { action: state("think"), duration: "think", caption: text("Una pausa antes de actuar.", "A pause before acting." ) },
      { action: state("Hello"), duration: "reaction", caption: text("El ejemplo elige saludar.", "The example chooses to wave." ) },
    ],
  },
  {
    id: "answers", title: text("Responde", "Answers"),
    description: text("A veces, un gesto lo dice todo.", "Sometimes, a gesture says it all."),
    scenario: text("Dos respuestas visuales: sí y no.", "Two visual answers: yes and no."),
    explanation: text("Secuencia fija de los estados yes y no; no interpreta una pregunta real.", "A fixed sequence of the yes and no states; it does not interpret a real question."),
    steps: [
      { action: state("yes"), duration: "answer", caption: text("Sí.", "Yes." ) },
      { action: state("no"), duration: "answer", caption: text("No.", "No." ) },
    ],
  },
  {
    id: "talks", title: text("Habla", "Talks"),
    description: text("Piensa, se expresa y encuentra su voz.", "Thinks, expresses itself and finds its voice."),
    scenario: text("Una frase escrita de ejemplo, sin audio.", "An example written sentence, without audio."),
    explanation: text("Gesto Talk y texto preescrito. No se consulta un modelo ni se genera voz.", "Talk gesture and prewritten text. No model request or generated voice."),
    steps: [
      { action: state("think"), duration: "think", caption: text("Primero, una pausa.", "First, a pause." ) },
      { action: state("Talk"), duration: "talk", caption: text("¡Hola! Una pequeña criatura, muchas formas de responder.", "Hi! A tiny creature, many ways to respond." ) },
    ],
  },
  {
    id: "transforms", title: text("Se transforma", "Transforms"),
    description: text("La misma criatura. Otra silueta.", "The same creature. A different silhouette."),
    scenario: text("Estrella → cuadrado → triángulo.", "Star → square → triangle."),
    explanation: text("Formas verificadas con prove2 y el controlador existente. Cada transformación regresa a Base.", "Shapes verified with prove2 and the existing controller. Each transformation returns to Base."),
    steps: [
      { action: { kind: "morph", form: "star" }, duration: "morph", caption: text("Estrella.", "Star." ) },
      { action: { kind: "morph", form: "square" }, duration: "morph", caption: text("Cuadrado.", "Square." ) },
      { action: { kind: "morph", form: "triangle" }, duration: "morph", caption: text("Triángulo.", "Triangle." ) },
    ],
  },
  {
    id: "adapts", title: text("Se adapta", "Adapts"),
    description: text("El contexto también cambia la reacción.", "Context changes the reaction, too."),
    scenario: text("Ejemplo: regreso tras 12 segundos de ausencia.", "Example: a return after 12 seconds away."),
    explanation: text("Personalidad de ejemplo: energía 72, confianza 58, curiosidad 80. Ausencia simulada; no cambia tu sesión.", "Example personality: energy 72, trust 58, curiosity 80. Simulated absence; your session is unchanged."),
    steps: [
      { action: state("Base"), duration: "observe", caption: text("La escena simula una breve ausencia.", "The scene simulates a short absence." ) },
      { action: state("Hello"), duration: "reaction", caption: text("Un saludo cuando regresas.", "A wave when you return." ) },
    ],
  },
  {
    id: "stays", title: text("Sigue contigo", "Stays with you"),
    description: text("Si la red falla, Jev sigue aquí.", "If the network fails, Jev stays here."),
    scenario: text("Ejemplo: decisión remota no disponible.", "Example: remote decision unavailable."),
    explanation: text("Reacción local predefinida. No es una lectura de tu conexión ni una respuesta hablada inventada.", "Predefined local reaction. Not a reading of your connection or a fabricated spoken reply."),
    steps: [
      { action: state("Base"), duration: "observe", caption: text("Modo local de ejemplo.", "Example local mode." ) },
      { action: state("Flower"), duration: "reaction", caption: text("La reacción visual continúa.", "The visual reaction continues." ) },
    ],
  },
] as const satisfies readonly Chapter[];
export type ChapterId = (typeof CHAPTERS)[number]["id"];
export function chapterAt(index: number): Chapter { return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, Math.trunc(index)))]; }

export const showcaseCopy = {
  es: {
    eyebrow: "CONOCE A JEV", title: "Más que una cara.", accent: "Una forma de estar.",
    intro: "Ocho pequeñas escenas. Mira lo que Jev puede hacer.", example: "Demostración · datos de ejemplo",
    offline: "Guion fijo. Sin IA ni cambios en tu sesión.", previous: "Anterior", next: "Siguiente", replay: "Repetir escena",
    chapters: "Capítulos de capacidades", play: "Ver escena", detail: "Cómo funciona", progress: "Progreso de capítulos",
    loading: "Preparando a Jev…", preparing: "Preparando escena…", playing: "Reproduciendo", complete: "Escena completa",
    interrupted: "Escena pausada", static: "Vista sin movimiento", error: "No se pudo cargar la escena. Puedes seguir leyendo los capítulos.",
    retry: "Reintentar carga", context: "Situación de ejemplo", confidence: "Confianza de ejemplo", action: "Acción de ejemplo",
    energy: "Energía", trust: "Confianza", curiosity: "Curiosidad", personality: "Personalidad de ejemplo",
    conclusion: "Ahora te toca a ti.", back: "Probar a Jev", end: "En Inicio, cada interacción es tuya.",
    decisionMeaning: "La decisión es una acción concreta: saludar, responder, hablar o transformarse.",
    confidenceMeaning: "La confianza acompaña esa elección. Un 94 % no garantiza que una respuesta sea correcta.",
    confidenceDetail: "Es una puntuación del contrato de decisión, no una garantía calibrada ni la confianza guardada en su personalidad.",
    readingsMeaning: "Intensidad y atención son otros valores de la decisión que puedes inspeccionar en el HUD de Inicio.",
    sample: "Ejemplo fijo, no una lectura en vivo", intensity: "Intensidad", attention: "Atención",
  },
  en: {
    eyebrow: "MEET JEV", title: "More than a face.", accent: "A way of being.",
    intro: "Eight little scenes. See what Jev can do.", example: "Demonstration · example data",
    offline: "Fixed script. No AI or changes to your session.", previous: "Previous", next: "Next", replay: "Replay scene",
    chapters: "Feature chapters", play: "View scene", detail: "How it works", progress: "Chapter progress",
    loading: "Getting Jev ready…", preparing: "Preparing scene…", playing: "Playing", complete: "Scene complete",
    interrupted: "Scene paused", static: "Reduced-motion view", error: "The scene could not load. You can still read the chapters.",
    retry: "Retry loading", context: "Example situation", confidence: "Example confidence", action: "Example action",
    energy: "Energy", trust: "Trust", curiosity: "Curiosity", personality: "Example personality",
    conclusion: "Now it's your turn.", back: "Try Jev", end: "On Home, every interaction is yours.",
    decisionMeaning: "A decision is a concrete action: wave, answer, talk or transform.",
    confidenceMeaning: "Confidence accompanies that choice. A 94% score does not guarantee a correct answer.",
    confidenceDetail: "It is a score in the decision contract, not a calibrated guarantee or the trust value stored in its personality.",
    readingsMeaning: "Intensity and attention are other values in a decision that you can inspect in the Home HUD.",
    sample: "Fixed example, not a live reading", intensity: "Intensity", attention: "Attention",
  },
} satisfies Record<Language, Record<string, string>>;
