import type { Language } from "../../stores/preferencesStore";
import type { StorySceneId } from "../story/catalog";

// Facts come from docs/jev-story.md and the introduction approved on 2026-10-24: an introduction, not a pitch.

export type ContactId = "github" | "linkedin" | "instagram" | "tiktok" | "x";
type Contact = { id: ContactId; name: string; handle: string; url: string | null };
// Where to find the author. A null url is still pending from the author and is not shown.
export const AUTHOR_CONTACTS: readonly Contact[] = [
  { id: "github", name: "GitHub", handle: "abdair-coca", url: "https://github.com/abdair-coca" },
  { id: "linkedin", name: "LinkedIn", handle: "Abdair Coca", url: "https://www.linkedin.com/in/abdair-coca-18113b259" },
  { id: "instagram", name: "Instagram", handle: "@abdaircoca", url: "https://www.instagram.com/abdaircoca" },
  { id: "tiktok", name: "TikTok", handle: "@abdaircoca", url: "https://www.tiktok.com/@abdaircoca" },
  { id: "x", name: "X", handle: "", url: null },
];
/** The author's photo: the particle portrait samples it and the contact shows it as is. */
export const AUTHOR_PORTRAIT = "/story/Abdair.jpg";

/** The projects the story walks through, by its scene ids; their copy and images stay in the story catalog. */
export const AUTHOR_WORK: readonly { scene: Exclude<StorySceneId, "creator">; name: string }[] = [
  { scene: "bob", name: "Bob" },
  { scene: "titi", name: "TitiEdu" },
  { scene: "learning", name: "machine-learning-App" },
  { scene: "vision", name: "Jev" },
];

type AuthorCopyKey = "eyebrow" | "lead" | "scroll" | "portrait" | "interests" | "work" | "workTitle" | "workLead"
  | "project" | "meetJev" | "contact" | "contactTitle" | "question" | "questionSource" | "story" | "back";
type AuthorCopy = Record<AuthorCopyKey, string> & {
  /** The title's words, so each one can rise on its own. */
  title: readonly string[];
  /** The interests sentence; words in [brackets] light up in the accent. */
  statement: string;
};

export const authorCopy = {
  es: {
    eyebrow: "ABDAIR COCA", title: ["Hola,", "soy", "Abdair."],
    lead: "Estudiante de Ingeniería Informática. Exploro la IA construyendo.",
    scroll: "Desliza", portrait: "Abdair Coca",
    interests: "INTERESES",
    statement: "Me interesan la [inteligencia artificial], el [desarrollo de software] y las [interfaces interactivas].",
    work: "PROYECTOS", workTitle: "Aprendo construyendo.",
    workLead: "Un robot de cartón, plataformas para enseñar y personajes como Jev.",
    project: "Ver proyecto", meetJev: "Interactuar con Jev",
    contact: "CONTACTO", contactTitle: "Me encuentras en",
    question: "¿Qué pasaría si una IA no viviera dentro de una caja de chat?", questionSource: "La pregunta con la que nació Jev.",
    story: "Conoce la historia de Jev", back: "Interactuar con Jev",
  },
  en: {
    eyebrow: "ABDAIR COCA", title: ["Hi,", "I'm", "Abdair."],
    lead: "Computer Engineering student. I explore AI by building.",
    scroll: "Scroll", portrait: "Abdair Coca",
    interests: "INTERESTS",
    statement: "I'm interested in [artificial intelligence], [software development] and [interactive interfaces].",
    work: "PROJECTS", workTitle: "I learn by building.",
    workLead: "A cardboard robot, teaching platforms and characters like Jev.",
    project: "View project", meetJev: "Interact with Jev",
    contact: "CONTACT", contactTitle: "You can find me on",
    question: "What if an AI didn't live inside a chat box?", questionSource: "The question Jev was born from.",
    story: "Read Jev's story", back: "Interact with Jev",
  },
} satisfies Record<Language, AuthorCopy>;

/** Splits the statement into words, marking the ones inside [brackets]. */
export function statementWords(statement: string) {
  let inside = false;
  return statement.split(" ").map(raw => {
    const opens = raw.startsWith("[");
    const closes = raw.includes("]");
    const key = inside || opens;
    inside = (inside || opens) && !closes;
    return { text: raw.replace(/[[\]]/g, ""), key };
  });
}
