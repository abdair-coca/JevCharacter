import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePreferences } from "../stores/preferencesStore";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference";
import { navigate } from "../navigation/routes";
import { acquirePresentationScroll } from "../features/presentation/scrollRuntime";
import { useStageVisibility } from "../features/presentation/useStageVisibility";
import { AUTHOR_PORTRAIT, authorCopy } from "../features/author/catalog";
import { PortraitParticles } from "../features/author/PortraitParticles";
import { AuthorStatement } from "../features/author/AuthorStatement";
import { AuthorWork } from "../features/author/AuthorWork";
import { AuthorContact } from "../features/author/AuthorContact";
import "../features/author/author.css";

/** Abdair's own section: a particle portrait, the interests, the projects and where to find him. */
export default function AuthorPage() {
  const language = usePreferences(value => value.language);
  const copy = authorCopy[language];
  const visible = usePageVisibility();
  const reduced = useReducedMotionPreference();
  const root = useRef<HTMLElement | null>(null);
  const hero = useRef<HTMLElement | null>(null);
  const inView = useStageVisibility(hero);
  const [particleError, setParticleError] = useState(false);
  const particlesFailed = useCallback(() => setParticleError(true), []);
  const particles = !reduced && !particleError && typeof IntersectionObserver !== "undefined";
  const scroll = useRef<ReturnType<typeof acquirePresentationScroll> | null>(null);

  // The same smooth scroll as the presentations, so the lit words and the dissolving portrait glide.
  useEffect(() => {
    if (reduced) return;
    const lease = acquirePresentationScroll(Number.parseFloat(getComputedStyle(root.current!).getPropertyValue("--author-scroll-lerp")));
    scroll.current = lease;
    return () => { lease.release(); scroll.current = null; };
  }, [reduced]);
  useEffect(() => { scroll.current?.setActive(visible); }, [visible, reduced]);

  return (
    <main className="author-page" ref={root} data-static={reduced}>
      <section className="author-hero" ref={hero} aria-labelledby="page-title">
        <div className="author-hero__copy">
          <p className="author-eyebrow author-hero__eyebrow">{copy.eyebrow}</p>
          <h1 id="page-title" className="author-title" data-page-route="/abdair" tabIndex={-1}>
            {copy.title.map((word, index) => (
              <Fragment key={`${language}-${word}`}>
                {index > 0 && " "}
                <span className="author-title__word" data-last={index === copy.title.length - 1}><span style={{ "--i": index } as CSSProperties}>{word}</span></span>
              </Fragment>
            ))}
          </h1>
          <p className="author-lead">{copy.lead}</p>
          <p className="author-scroll-cue"><span aria-hidden="true">↓</span> {copy.scroll}</p>
        </div>
        <div className="author-portrait" data-particles={particles}>
          {particles
            ? <PortraitParticles src={AUTHOR_PORTRAIT} active={visible && inView} onError={particlesFailed} />
            : <img className="author-portrait__photo" src={AUTHOR_PORTRAIT} alt={copy.portrait} />}
          <span className="author-portrait__halo" aria-hidden="true" />
        </div>
      </section>
      <AuthorStatement language={language} />
      <AuthorWork language={language} reduced={reduced} />
      <AuthorContact language={language} />
      <footer className="author-outro">
        <blockquote><p>{copy.question}</p></blockquote>
        <p className="author-outro__source">{copy.questionSource}</p>
        <div className="author-outro__links">
          <a className="ui-button ui-button--primary ui-button--default" href="/about" onClick={event => navigate(event, "/about")}>{copy.story} <span className="ui-button__arrow" aria-hidden="true">↗</span></a>
          <a className="ui-button ui-button--ghost ui-button--default" href="/" onClick={event => navigate(event, "/")}>{copy.back} <span className="ui-button__arrow" aria-hidden="true">↗</span></a>
        </div>
      </footer>
    </main>
  );
}
