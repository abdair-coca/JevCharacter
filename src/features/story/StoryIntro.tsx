import type { Language } from "../../stores/preferencesStore";
import { STORY_CONTACTS, STORY_PORTRAIT, storyCopy } from "./catalog";
import { STORY_ICONS } from "./icons";

/** Abdair's introduction and contact links, between the journey and the closing line. */
export function StoryIntro({ language }: { language: Language }) {
  const copy = storyCopy[language];
  const contacts = STORY_CONTACTS.flatMap(contact => contact.url === null ? [] : [{ ...contact, url: contact.url }]);
  return (
    <section className="story-intro" aria-labelledby="story-intro-title">
      {STORY_PORTRAIT
        ? <img className="story-intro__portrait" src={STORY_PORTRAIT} alt={copy.portrait} loading="lazy" />
        : <span className="story-intro__portrait" aria-hidden="true">AC</span>}
      <div className="story-intro__copy">
        <h2 id="story-intro-title">{copy.introTitle}</h2>
        <p>{copy.intro}</p>
        <p className="story-eyebrow" id="story-contact-title">{copy.contact}</p>
        <ul className="story-contact" aria-labelledby="story-contact-title">
          {contacts.map(contact => (
            <li key={contact.id}>
              <a href={contact.url} target="_blank" rel="noopener noreferrer" aria-label={contact.name} title={contact.name}>
                <svg viewBox="0 0 24 24" aria-hidden="true">{STORY_ICONS[contact.id]}</svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
