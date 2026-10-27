import type { ReactNode } from "react";
import { m } from "motion/react";
import type { Language } from "../../stores/preferencesStore";
import { useTranslation } from "../../i18n/useTranslation";
import { useOrganicMotion, useUiMotion } from "../../lib/motionTokens";
import { AUTHOR_CONTACTS, AUTHOR_PORTRAIT, authorCopy, type ContactId } from "./catalog";

// Line icons on the header's 24-unit grid, stroked with the text color.
const CONTACT_ICONS: Record<ContactId, ReactNode> = {
  github: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
  linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" /><path d="M2 9h4v12H2Z" /><circle cx="4" cy="4" r="2" /></>,
  instagram: <><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.4 4.6 5 5" />,
  x: <path d="M4 4h4.5L20 20h-4.5ZM20 4l-6.8 7.6M4 20l6.8-7.6" />,
};

/** The photo beside large rows for each network; only contacts with an address are drawn. */
export function AuthorContact({ language }: { language: Language }) {
  const copy = authorCopy[language];
  const t = useTranslation();
  const transition = useUiMotion();
  const { stagger, revealScale } = useOrganicMotion();
  const contacts = AUTHOR_CONTACTS.flatMap(contact => contact.url === null ? [] : [{ ...contact, url: contact.url }]);
  return (
    <section className="author-contact" aria-labelledby="author-contact-title">
      <m.div className="author-contact__portrait" initial={{ opacity: 0, scale: revealScale }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={transition}>
        <span className="author-contact__ring" aria-hidden="true" />
        <img src={AUTHOR_PORTRAIT} alt={copy.portrait} loading="lazy" />
      </m.div>
      <div className="author-contact__body">
        <p className="author-eyebrow">{copy.contact}</p>
        <h2 id="author-contact-title">{copy.contactTitle}</h2>
        <ul className="author-links" aria-labelledby="author-contact-title">
          {contacts.map((contact, index) => (
            <m.li key={contact.id} initial={{ opacity: 0, x: "var(--author-slide)" }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "0px 0px -10% 0px" }} transition={{ ...transition, delay: index * stagger }}>
              <a className="author-link" href={contact.url} target="_blank" rel="noopener noreferrer" data-contact={contact.id}>
                <span className="author-link__icon" aria-hidden="true"><svg viewBox="0 0 24 24">{CONTACT_ICONS[contact.id]}</svg></span>
                <span className="author-link__name">{contact.name}</span>
                <span className="author-link__handle">{contact.handle}</span>
                <span className="author-link__arrow" aria-hidden="true">↗</span>
                <span className="sr-only">{t.newTab}</span>
              </a>
            </m.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
