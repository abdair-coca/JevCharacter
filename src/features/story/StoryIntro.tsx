import type { ReactNode } from "react";
import type { Language } from "../../stores/preferencesStore";
import { STORY_CONTACTS, STORY_PORTRAIT, storyCopy, type ContactId } from "./catalog";

// Line icons on the header's 24-unit grid, stroked with the text color.
const CONTACT_ICONS: Record<ContactId, ReactNode> = {
  github: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
  linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" /><path d="M2 9h4v12H2Z" /><circle cx="4" cy="4" r="2" /></>,
  instagram: <><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.4 4.6 5 5" />,
  x: <path d="M4 4h4.5L20 20h-4.5ZM20 4l-6.8 7.6M4 20l6.8-7.6" />,
};

/** Abdair's introduction and contact links, between the journey and the closing line. */
export function StoryIntro({ language }: { language: Language }) {
  const copy = storyCopy[language];
  const contacts = STORY_CONTACTS.flatMap(contact => contact.url === null ? [] : [{ ...contact, url: contact.url }]);
  return (
    <section className="story-intro" aria-labelledby="story-intro-title">
      {STORY_PORTRAIT
        ? <img className="story-intro__portrait" src={STORY_PORTRAIT} alt={copy.portrait} />
        : <span className="story-intro__portrait" aria-hidden="true">AC</span>}
      <div className="story-intro__copy">
        <h2 id="story-intro-title">{copy.introTitle}</h2>
        <p>{copy.intro}</p>
        <p className="story-eyebrow" id="story-contact-title">{copy.contact}</p>
        <ul className="story-contact" aria-labelledby="story-contact-title">
          {contacts.map(contact => (
            <li key={contact.id}>
              <a href={contact.url} target="_blank" rel="noopener noreferrer" aria-label={contact.name} title={contact.name}>
                <svg viewBox="0 0 24 24" aria-hidden="true">{CONTACT_ICONS[contact.id]}</svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
