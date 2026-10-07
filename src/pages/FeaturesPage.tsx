import { lazy, Suspense, useCallback, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, m } from "motion/react";
import type { CharacterController } from "../character/useCharacterController";
import { usePreferences } from "../stores/preferencesStore";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference";
import { useUiMotion } from "../lib/motionTokens";
import { navigate } from "../navigation/routes";
import { Button } from "../components/ui/button";
import { CHAPTERS, chapterAt, showcaseCopy } from "../features/showcase/catalog";
import { useShowcasePlayer } from "../features/showcase/useShowcasePlayer";
import { useShowcaseScroll } from "../features/showcase/useShowcaseScroll";
import { useStageVisibility } from "../features/showcase/useStageVisibility";
import "../features/showcase/showcase.css";

const Character = lazy(() => import("../components/Character"));
type CursorStyle = CSSProperties & { "--demo-cursor-x": string; "--demo-cursor-y": string };

export default function FeaturesPage() {
  const language = usePreferences(value => value.language);
  const theme = usePreferences(value => value.theme);
  const copy = showcaseCopy[language];
  const visible = usePageVisibility();
  const motionPreference = useReducedMotionPreference();
  const reduced = motionPreference || typeof IntersectionObserver === "undefined";
  const transition = useUiMotion();
  const root = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const inView = useStageVisibility(stage);
  const running = visible && inView;
  const controller = useRef<CharacterController | null>(null);
  const [attempt, setAttempt] = useState(0);
  const activeAttempt = useRef(0);
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpButton = useRef<HTMLButtonElement | null>(null);
  const { actor, snapshot } = useShowcasePlayer(controller, running, reduced);
  const chapterIndex = snapshot.context.chapter;
  const chapter = chapterAt(chapterIndex);
  const step = chapter.steps[snapshot.context.step];
  const phase = snapshot.value;
  const scrollSelect = useCallback((index: number) => actor.send({ type: "SELECT", chapter: index }), [actor]);
  const scrollToChapter = useShowcaseScroll(root, stage, scrollSelect, running, reduced, `${language}-${theme}`, chapterIndex);
  const choose = (index: number) => { actor.send({ type: "SELECT", chapter: index }); scrollToChapter(index); if (jumpOpen) jumpButton.current?.focus(); setJumpOpen(false); };
  const ready = useCallback(() => { if (activeAttempt.current === attempt) actor.send({ type: "READY" }); }, [actor, attempt]);
  const failed = useCallback(() => { if (activeAttempt.current === attempt) actor.send({ type: "ERROR" }); }, [actor, attempt]);
  const retry = () => { activeAttempt.current++; actor.send({ type: "RETRY" }); setAttempt(value => value + 1); };
  const stateText = phase === "prepare" ? copy.preparing : phase === "loading" ? copy.loading : phase === "playing" ? copy.playing : phase === "complete" ? copy.complete : phase === "static" ? copy.static : phase === "error" ? copy.error : copy.interrupted;
  const cursor: CursorStyle = { "--demo-cursor-x": `${(step.cursor?.x ?? 0.5) * 100}%`, "--demo-cursor-y": `${(step.cursor?.y ?? 0.5) * 100}%` };

  return (
    <main className="features-page" ref={root} data-showcase-phase={String(phase)} data-chapter={chapter.id} data-step={snapshot.context.step}>
      <header className="features-intro">
        <p className="features-eyebrow">{copy.eyebrow}</p>
        <h1 id="page-title" data-page-route="/features" tabIndex={-1}>{copy.title}<br /><em>{copy.accent}</em></h1>
        <p>{copy.intro}</p>
        <p className="features-note">{copy.offline}</p>
        <span className="features-scroll-cue" aria-hidden="true">↓</span>
      </header>
      <div className="showcase-workspace">
        <div className="showcase-stage" ref={stage}>
          <div className="showcase-flight" id="showcase-scene" role="group" aria-label={`Jev — ${chapter.title[language]}`}>
            <div className="creature-zone showcase-creature">
              <div className="creature-presence">
                <Suspense fallback={<span className="character-loading">{copy.loading}</span>}>
                  <Character key={attempt} ref={controller} onReady={ready} onError={failed} active={running && phase !== "error"} presentation staticPose={reduced} />
                </Suspense>
              </div>
              {step.cursor && <span className="showcase-cursor" style={cursor} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 3 14 11-7 1-3 7z" /></svg></span>}
            </div>
            <div className="showcase-caption" role="status" aria-live="polite">
              {running && <AnimatePresence mode="wait" initial={false}>
                {(chapter.id === "talks" || chapter.id === "answers") && phase !== "interrupted" && <m.p key={`${chapter.id}-${snapshot.context.step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>{phase === "static" ? chapter.scenario[language] : step.caption[language]}</m.p>}
              </AnimatePresence>}
            </div>
          </div>
        </div>
        <div className="showcase-chapters">
          {CHAPTERS.map((item, index) => (
            <section className="showcase-chapter" id={`chapter-${item.id}`} key={item.id} data-chapter-card={index} data-selected={index === chapterIndex} aria-labelledby={`title-${item.id}`}>
              <div className="showcase-chapter__copy">
              <span className="showcase-chapter__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h2 id={`title-${item.id}`}>{item.title[language]}<span aria-hidden="true">.</span></h2>
              <p className="showcase-chapter__description">{item.description[language]}</p>
              {reduced && <ol className="showcase-static-steps">{item.steps.map((entry, ordinal) => <li key={ordinal}>{entry.caption[language]}</li>)}</ol>}
              <p className="showcase-chapter__scenario">{item.scenario[language]}</p>
              {item.id === "decides" && <div className="showcase-decision">
                <p>{copy.decisionMeaning}</p>
                <dl><div><dt>{copy.action}</dt><dd>reaction / HELLO</dd></div><div><dt>{copy.confidence}</dt><dd>94 %</dd></div></dl>
                <div className="showcase-confidence-track" aria-hidden="true"><span style={{ transform: "scaleX(0.94)" }} /></div>
                <p className="showcase-sample-note">{copy.sample}</p>
                <p>{copy.confidenceMeaning}</p>
              </div>}
              {item.id === "adapts" && <div className="showcase-personality"><p>{copy.personality}</p><dl><div><dt>{copy.energy}</dt><dd>72</dd></div><div><dt>{copy.trust}</dt><dd>58</dd></div><div><dt>{copy.curiosity}</dt><dd>80</dd></div></dl></div>}
              <Button variant="ghost" onClick={() => choose(index)} aria-label={`${copy.play}: ${item.title[language]}`}>{copy.play} <span aria-hidden="true">↗</span></Button>
              <details><summary>{copy.detail}</summary><p>{item.explanation[language]}</p>{item.id === "decides" && <><p>{copy.confidenceDetail}</p><p>{copy.readingsMeaning}</p></>}</details>
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="showcase-navigation">
        <div className="showcase-controls" aria-label={copy.chapters}>
          <Button variant="ghost" size="small" onClick={() => choose(chapterIndex - 1)} disabled={chapterIndex === 0}><span aria-hidden="true">←</span> {copy.previous}</Button>
          <Button variant="ghost" size="small" onClick={() => actor.send({ type: "REPLAY" })} disabled={phase === "loading" || phase === "error"}><span aria-hidden="true">↻</span> {copy.replay}</Button>
          <Button variant="ghost" size="small" onClick={() => choose(chapterIndex + 1)} disabled={chapterIndex === CHAPTERS.length - 1}>{copy.next} <span aria-hidden="true">→</span></Button>
        </div>
        <button className="showcase-jump-toggle" ref={jumpButton} type="button" aria-label={copy.progress} aria-expanded={jumpOpen} aria-controls="showcase-chapter-jump" onClick={() => setJumpOpen(value => !value)}>{String(chapterIndex + 1).padStart(2, "0")} / 08 <span aria-hidden="true">⌃</span></button>
        <nav className="showcase-progress" id="showcase-chapter-jump" aria-label={copy.progress} data-mobile-open={jumpOpen}>
          {CHAPTERS.map((item, index) => <button key={item.id} type="button" aria-label={`${index + 1}. ${item.title[language]}`} aria-current={index === chapterIndex ? "step" : undefined} aria-controls="showcase-scene" onClick={() => choose(index)}>{String(index + 1).padStart(2, "0")}</button>)}
        </nav>
        <p className={phase === "error" || phase === "loading" ? "showcase-status" : "sr-only"} data-phase={String(phase)} role="status">{stateText}</p>
        {phase === "error" && <Button variant="ghost" onClick={retry}>{copy.retry}</Button>}
      </div>
      <footer className="features-outro"><h2>{copy.conclusion}</h2><p>{copy.end}</p><a className="ui-button ui-button--primary ui-button--default" href="/" onClick={event => navigate(event, "/")}>{copy.back} <span aria-hidden="true">↗</span></a></footer>
    </main>
  );
}
