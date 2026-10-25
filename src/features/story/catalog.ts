import type { Language } from "../../stores/preferencesStore";

type StoryText = Record<Language, string>;
/** `animated` marks an animated image: the static reading shows its first frame. */
type StoryScene = { id: string; label: StoryText; title: StoryText; lead: StoryText; detail: StoryText; caption: StoryText; image: string | null; animated?: true; projectUrl?: string };
const text = (es: string, en: string): StoryText => ({ es, en });

// Author-provided facts in docs/jev-story.md. Order is editorial, not a dated timeline.
export const STORY_SCENES = [
  {
    id: "creator", label: text("EL RECORRIDO", "THE JOURNEY"), image: null,
    title: text("Ideas que\ncobran vida.", "Ideas that\ncome alive."),
    lead: text("Soy Abdair Coca, estudiante de Ingeniería Informática. Exploro la IA construyendo.", "I'm Abdair Coca, a Computer Engineering student. I explore AI by building."),
    detail: text("Soy estudiante de Ingeniería Informática. Exploro inteligencia artificial, desarrollo de software e interfaces interactivas mediante proyectos, pruebas y muchas iteraciones. Este es un recorrido por algunos de ellos.", "I'm a Computer Engineering student. I explore artificial intelligence, software development and interactive interfaces through projects, experiments and many iterations. This is a journey through some of them."),
    caption: text("Abdair Coca · Ingeniería Informática", "Abdair Coca · Computer Engineering"),
  },
  {
    id: "bob", label: text("BOB", "BOB"), image: "/story/bob.jpeg", projectUrl: "https://github.com/abdair-coca/Robotsito",
    title: text("Todo empezó\ncon cartón.", "It started\nwith cardboard."),
    lead: text("Mi primer gran proyecto: un robot con IA, ojos expresivos y memoria persistente.", "My first big project: a robot with AI, expressive eyes and persistent memory."),
    detail: text("Bob fue mi primer gran proyecto: un robot de cartón impulsado por IA. Reconoce personas, mueve la cabeza y sigue caras, puede hablar y expresa lo que siente a través de sus ojos. Tiene comportamiento emocional y memoria persistente.", "Bob was my first big project: an AI-powered cardboard robot. It recognizes people, moves its head and tracks faces, can speak and expresses how it feels through its eyes. It has emotional behavior and persistent memory."),
    caption: text("Bob · De cartón, con personalidad", "Bob · Cardboard, with personality"),
  },
  {
    id: "titi", label: text("TITIEDU", "TITIEDU"), image: "/story/curiousTiti.webp", animated: true, projectUrl: "https://titiedu.vercel.app",
    title: text("Construir\npara enseñar.", "Building\nto teach."),
    lead: text("Programación orientada a objetos, IA y un espacio para aprender jugando.", "Object-oriented programming, AI and a space to learn through play."),
    detail: text("Usé TitiEdu para enseñar programación orientada a objetos a mis estudiantes. Hoy es una plataforma completa con IA, un sistema RAG y un simulador integrado de juegos con HTML, CSS y JavaScript.", "I used TitiEdu to teach object-oriented programming to my students. Today it is a complete platform with AI, a RAG system and an integrated HTML, CSS and JavaScript game simulator."),
    caption: text("TitiEdu · Curiosidad en cada paso", "TitiEdu · Curiosity at every step"),
  },
  {
    id: "learning", label: text("MACHINE LEARNING", "MACHINE LEARNING"), image: "/story/housingML.svg", projectUrl: "https://machine-learning-app-gilt.vercel.app",
    title: text("Entender.\nProbar. Descubrir.", "Understand.\nTry. Discover."),
    lead: text("Algoritmos que puedes explorar ejecutando código dentro de la app.", "Algorithms you can explore by running code inside the app."),
    detail: text("machine-learning-App es una plataforma para aprender algoritmos de machine learning con Pyodide. Permite ejecutar código dentro de la propia aplicación y experimentar mientras aprendes. El gráfico representa el recurso ml/housing que acompaña este proyecto.", "machine-learning-App is a platform for learning machine learning algorithms with Pyodide. It lets you run code inside the application and experiment as you learn. The chart represents the ml/housing resource supplied for this project."),
    caption: text("machine-learning-App · Código y datos", "machine-learning-App · Code and data"),
  },
  {
    id: "vision", label: text("JEV", "JEV"), image: null,
    title: text("¿Y si la interfaz\nestuviera viva?", "What if the interface\nwere alive?"),
    lead: text("JEV explora otra forma de interactuar: un personaje que mira, reacciona y decide.", "JEV explores another way to interact: a character that looks, reacts and decides."),
    detail: text("Experimenté con Rive, React e IA para que el personaje fuera parte del producto, no un avatar encima de un chatbot. JEV sigue siendo un experimento. La visión futura es entender contexto, recordar, actuar y evolucionar con el usuario; no es una lista de capacidades entregadas. Hoy conserva personalidad local y notas cortas sobre ti en tu navegador, aún lejos de la memoria persistente de Bob.", "I experimented with Rive, React and AI to make the character part of the product, not an avatar on a chatbot. JEV is still an experiment. The future vision is to understand context, remember, act and evolve with its user; it is not a list of shipped capabilities. Today it keeps local personality and short notes about you in your browser, still far from Bob's persistent memory."),
    caption: text("JEV · Tiny creature. Big decisions.", "JEV · Tiny creature. Big decisions."),
  },
] as const satisfies readonly StoryScene[];

export type StorySceneId = (typeof STORY_SCENES)[number]["id"];

export type ContactId = "github" | "linkedin" | "instagram" | "tiktok" | "x";
type Contact = { id: ContactId; name: string; url: string | null };
// Where to find the author. A null url is still pending from the author and is not shown.
export const STORY_CONTACTS: readonly Contact[] = [
  { id: "github", name: "GitHub", url: "https://github.com/abdair-coca" },
  { id: "linkedin", name: "LinkedIn", url: null },
  { id: "instagram", name: "Instagram", url: null },
  { id: "tiktok", name: "TikTok", url: null },
  { id: "x", name: "X", url: null },
];
// The author's photo, also pending: until then the initials stand in.
export const STORY_PORTRAIT: string | null = null;

type StoryCopyKey = "navigation" | "previous" | "next" | "detail" | "scroll" | "scene"
  | "loading" | "error" | "retry" | "experiment" | "vision" | "back" | "features" | "end"
  | "particleError" | "reveal" | "revealAction" | "project" | "introTitle" | "intro" | "contact" | "portrait";
export const storyCopy = {
  es: {
    navigation: "Escenas de la historia", previous: "Escena anterior", next: "Escena siguiente",
    detail: "Un poco más de historia", scroll: "Desliza para descubrir la historia",
    scene: "Escena", loading: "Preparando a Jev…", error: "Jev no pudo cargar. La historia sigue disponible.", retry: "Reintentar carga",
    experiment: "Un recorrido de Abdair Coca.", vision: "Un experimento. La visión: evolucionar contigo.",
    back: "Interactuar con Jev", features: "Ver sus capacidades", end: "La historia sigue en cada interacción.",
    particleError: "Una imagen no pudo prepararse. Puedes seguir leyendo la historia.", reveal: "O sigue deslizando", revealAction: "Revelar a Jev", project: "Ver proyecto",
    // Approved by the author on 2026-10-24: an introduction, not a pitch.
    introTitle: "Hola, soy Abdair.",
    intro: "Estudio Ingeniería Informática y me interesan la inteligencia artificial, el desarrollo de software y las interfaces interactivas. Aprendo construyendo: un robot de cartón, plataformas para enseñar y personajes como Jev.",
    contact: "Me encuentras en", portrait: "Abdair Coca",
  },
  en: {
    navigation: "Story scenes", previous: "Previous scene", next: "Next scene",
    detail: "A little more of the story", scroll: "Scroll to discover the story",
    scene: "Scene", loading: "Getting Jev ready…", error: "Jev could not load. The story is still available.", retry: "Retry loading",
    experiment: "A journey by Abdair Coca.", vision: "An experiment. The vision: to evolve with you.",
    back: "Interact with Jev", features: "Explore its capabilities", end: "The story continues with every interaction.",
    particleError: "An image could not be prepared. You can still read the story.", reveal: "Or keep scrolling", revealAction: "Reveal Jev", project: "View project",
    introTitle: "Hi, I'm Abdair.",
    intro: "I study Computer Engineering and I'm interested in artificial intelligence, software development and interactive interfaces. I learn by building: a cardboard robot, teaching platforms and characters like Jev.",
    contact: "You can find me on", portrait: "Abdair Coca",
  },
} satisfies Record<Language, Record<StoryCopyKey, string>>;
