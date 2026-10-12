import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { usePreferences } from "../stores/preferencesStore";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference";
import { cssDurationSeconds, useUiMotion } from "../lib/motionTokens";
import { navigate } from "../navigation/routes";
import { Button } from "../components/ui/button";
import type { CharacterController } from "../character/useCharacterController";
import { useStageVisibility } from "../features/presentation/useStageVisibility";
import { STORY_SCENES, storyCopy } from "../features/story/catalog";
import { useStoryScroll } from "../features/story/useStoryScroll";
import { ParticleVortex } from "../features/story/ParticleVortex";
import "../features/story/story.css";

const Character = lazy(() => import("../components/Character"));
type LoadStatus = "loading" | "ready" | "error";

export default function AboutPage() {
  const language = usePreferences(value => value.language);
  const theme = usePreferences(value => value.theme);
  const copy = storyCopy[language];
  const visible = usePageVisibility();
  const motionPreference = useReducedMotionPreference();
  const [particleError, setParticleError] = useState(false);
  const [short, setShort] = useState(() => window.matchMedia?.("(max-height: 35rem)").matches ?? false);
  const reduced = motionPreference || short || particleError || typeof IntersectionObserver === "undefined";
  const transition = useUiMotion();
  const root = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const controller = useRef<CharacterController | null>(null);
  const inView = useStageVisibility(stage);
  const [selected, setSelected] = useState(0);
  // Jev starts loading at the first particle change ("Todo empezó con cartón"), so the Jev scene is ready.
  const [started, setStarted] = useState(false);
  const active = visible && inView;
  const { progress, reveal } = useStoryScroll(root, stage, { onScene: setSelected, active, visible, reduced, preferenceKey: `${language}-${theme}`, selected });
  const particlesFailed = useCallback(() => setParticleError(true), []);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const currentAttempt = useRef(0);
  const failed = useCallback(() => { if (currentAttempt.current === attempt) setStatus("error"); }, [attempt]);
  const ready = useCallback(() => {
    if (currentAttempt.current !== attempt || !controller.current) return;
    // Binding readiness precedes the first authored pose. Enter Base through the
    // existing controller before declaring the narrative illustration ready.
    void controller.current.idle().then(() => {
      if (currentAttempt.current === attempt) setStatus(value => value === "loading" ? "ready" : value);
    }).catch(failed);
  }, [attempt, failed]);
  const retry = () => { currentAttempt.current++; setStatus("loading"); setAttempt(value => value + 1); };

  useEffect(() => {
    const media = window.matchMedia?.("(max-height: 35rem)");
    if (!media) return;
    const sync = () => setShort(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => { if (selected >= 1) setStarted(true); }, [selected]);

  useEffect(() => {
    if (status !== "loading" || !active || !started) return;
    const duration = cssDurationSeconds(getComputedStyle(root.current!).getPropertyValue("--story-ready-timeout")) * 1000;
    const timeout = window.setTimeout(failed, duration);
    return () => window.clearTimeout(timeout);
  }, [status, active, started, failed]);

  return (
    <main className="story-page" ref={root} data-story-selected={STORY_SCENES[selected].id} data-static={reduced} data-story-status={status} data-particle-error={particleError}>
      <div className="story-workspace">
        <div className="story-stage" ref={stage}>
          <div className="story-flight">
            <div className="story-art" aria-hidden="true">
            <ParticleVortex progress={progress} active={active} reduced={reduced} onError={particlesFailed} />
            <div className="creature-zone story-creature"><div className="creature-presence">
               <Suspense fallback={null}>{started && <Character key={attempt} ref={controller} presentation staticPose={reduced} active={active && status !== "error" && (selected === 4 || status === "loading" || reduced)} onReady={ready} onError={failed} />}</Suspense>
            </div></div>
            <div className="story-nebula" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="story-scenes">
          {STORY_SCENES.map((scene, index) => (
            <section className="story-scene" id={`story-${scene.id}`} key={scene.id} data-story-scene={index} data-selected={index === selected} aria-labelledby={`story-title-${scene.id}`}>
              <div className="story-copy">
                <p className="story-eyebrow">{scene.label[language]}</p>
                {index === 0 ? <h1 id="page-title" data-page-route="/about" tabIndex={-1}><span id={`story-title-${scene.id}`}>{scene.title[language]}</span></h1> : <h2 id={`story-title-${scene.id}`}>{scene.title[language]}</h2>}
                <p className="story-lead">{scene.lead[language]}</p>
                {scene.id === "vision" && <p className="story-vision-note">{copy.vision}</p>}
                {index === 0 && <p className="story-scroll-cue"><span aria-hidden="true">↓</span> {copy.scroll}</p>}
                {scene.id === "vision" && <div className="story-reveal-cue"><Button variant="ghost" onClick={reveal}><span aria-hidden="true">✧</span> {copy.revealAction}</Button></div>}
              </div>
              <figure className="story-static-media">
                {scene.image && <img src={scene.image} alt={scene.caption[language]} loading="lazy" />}
                <figcaption>{scene.caption[language]}</figcaption>
              </figure>
            </section>
          ))}
        </div>
      </div>
      <div className="story-load-state" role="status">
        <AnimatePresence initial={false} mode="wait">
          {status !== "ready" && (selected === 4 || status === "error") && <m.div key={status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}><p>{status === "error" ? copy.error : copy.loading}</p>{status === "error" && <Button variant="ghost" onClick={retry}>{copy.retry}</Button>}</m.div>}
        </AnimatePresence>
      </div>
      {particleError && <p className="story-particle-error" role="status">{copy.particleError}</p>}
      <footer className="story-outro">
        <p className="story-eyebrow">JEVLING — {copy.experiment}</p>
        <h2 lang="en">Tiny creature. <br /><em>Big decisions.</em></h2>
        <p>{copy.end}</p>
        <div className="story-links"><a className="ui-button ui-button--primary ui-button--default" href="/" onClick={event => navigate(event, "/")}>{copy.back} <span aria-hidden="true">↗</span></a><a className="ui-button ui-button--ghost ui-button--default" href="/features" onClick={event => navigate(event, "/features")}>{copy.features} <span aria-hidden="true">↗</span></a></div>
      </footer>
    </main>
  );
}
