import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { AnimatePresence, m } from "motion/react";
import BrainHUD from "../components/BrainHUD";
import ContextWhisper from "../components/ContextWhisper";
import DebugPanel from "../components/DebugPanel";
import type { CharacterController } from "../character/useCharacterController";
import { useCreatureBrain } from "../hooks/useCreatureBrain";
import { usePointerSensor } from "../creature/sensors/pointerSensor";
import { useTranslation } from "../i18n/useTranslation";
import { useUiMotion } from "../lib/motionTokens";
import { usePreferences } from "../stores/preferencesStore";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference";
import { executeDecisionAction } from "../creature/rive/riveReactionAdapter";
import type { SpeechCaption as Caption } from "../hooks/useSpeechSession";
import { useEnrollment } from "../features/enrollment/useEnrollment";
import { useEnrollmentMotion } from "../features/enrollment/useEnrollmentMotion";
import { EnrollmentExperience } from "../features/enrollment/EnrollmentExperience";
import { EnrollmentParticles } from "../features/enrollment/EnrollmentParticles";
import CreatureLoader from "../features/loading/CreatureLoader";
import { useEnrollmentViewport } from "../features/enrollment/useEnrollmentViewport";
import { useSpeechVoice } from "../creature/voice/useSpeechVoice";
import { jevVoice } from "../creature/voice/voiceEngine";
import "../features/enrollment/enrollment.css";

const Character = lazy(() => import("../components/Character"));

type StageStyle = CSSProperties & { "--intensity": number; "--attention": number };
type SpeechCaptionProps = Caption & { onRevealed: (generation: number) => void };

function SpeechCaption({ text, complete, generation, language, onRevealed }: SpeechCaptionProps) {
  const transition = useUiMotion();
  useEffect(() => {
    if (complete) onRevealed(generation);
  }, [complete, generation, onRevealed]);
  return (
    <m.div className="speech-caption" lang={language} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
      <span aria-hidden="true">{text}</span>
      {complete && <span className="sr-only" role="status">{text}</span>}
    </m.div>
  );
}

export default function HomePage({ active = true }: { active?: boolean }) {
  const t = useTranslation();
  const transition = useUiMotion();
  const language = usePreferences(state => state.language);
  const visible = usePageVisibility();
  const running = active && visible;
  const enrollmentMotion = useEnrollmentMotion();
  const enrollment = useEnrollment(active, enrollmentMotion.close);
  const [enrollmentFocused, setEnrollmentFocused] = useState(false);
  const [characterStatus, setCharacterStatus] = useState<"loading" | "ready" | "error">("loading");
  const reducedMotion = useReducedMotionPreference();
  // The loader covers the wait until Jev is revealed, 1.8s after she is ready.
  const [characterRevealed, setCharacterRevealed] = useState(false);
  const conversational = running && !enrollment.isOpen;
  const stageRef = useRef<HTMLElement | null>(null);
  const creatureShellRef = useRef<HTMLDivElement | null>(null);
  const characterRef = useRef<CharacterController | null>(null);
  useEnrollmentViewport(stageRef, enrollment.isOpen);
  const [debugActive, setDebugActive] = useState(false);
  const wakePlayedRef = useRef(false);
  const sensors = usePointerSensor(stageRef, creatureShellRef, conversational, active && !enrollment.isOpen);
  const brain = useCreatureBrain(sensors, characterRef, { active: conversational, language });
  const enrollmentWasOpen = useRef(false);
  useSpeechVoice(brain.speechCaption, Boolean(brain.speechNotice), jevVoice, brain.onSpeechFinished);

  useEffect(() => {
    if (enrollment.phase === "closed") {
      if (enrollmentWasOpen.current) {
        enrollmentWasOpen.current = false;
        setEnrollmentFocused(false);
        if (running) {
          void characterRef.current?.idle();
          document.getElementById("creature-context")?.focus({ preventScroll: true });
        }
      }
      return;
    }
    enrollmentWasOpen.current = true;
    if (!running || characterStatus !== "ready" || enrollmentMotion.reduced) return;
    // The brain suspends in a layout effect. A cancellable frame starts our
    // choreography afterwards; late readiness always uses the current phase.
    const character = characterRef.current;
    const frame = requestAnimationFrame(() => {
      if (enrollment.phase === "closing") void character?.idle();
      else void character?.playFor(enrollment.phase === "confirmed" ? "Flower" : "Hello", enrollmentMotion.hold);
    });
    return () => { cancelAnimationFrame(frame); character?.stop(); };
  }, [enrollment.phase, running, characterStatus, enrollmentMotion.reduced, enrollmentMotion.hold]);

  const submitContext = (message: string) => {
    if (!running || enrollment.isOpen) return;
    if (enrollment.tryOpen(message)) setDebugActive(false);
    else brain.submitContext(message);
  };

  const handleStagePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!conversational) return;
    const target = event.target;
    if (target instanceof HTMLCanvasElement) return;
    if (target instanceof Element && target.closest("button, input, textarea, select, a, label, [role='button']")) return;
    void characterRef.current?.bump();
  }, [conversational]);
  const wakeCharacter = useCallback(() => {
    setCharacterStatus("ready");
    if (wakePlayedRef.current || !running) return;
    wakePlayedRef.current = true;
    if (enrollment.isOpen) return;
    if (brain.status === "deciding") void characterRef.current?.think();
    else if (!brain.userContext) void characterRef.current?.playFor("Hello", 1900);
    else if (brain.decision.action.kind !== "talk") void executeDecisionAction(characterRef.current, brain.decision);
    else if (brain.speechCaption?.text) void characterRef.current?.talk(brain.decision.action.state);
  }, [brain.decision, brain.speechCaption, brain.status, brain.userContext, running, enrollment.isOpen]);
  const characterFailed = useCallback(() => setCharacterStatus("error"), []);
  const revealCharacter = useCallback(() => setCharacterRevealed(true), []);
  useEffect(() => {
    if (!conversational) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "d") setDebugActive((value) => !value);
      if (event.key === "Escape") setDebugActive(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [conversational]);

  const style: StageStyle = { "--intensity": brain.decision.intensity, "--attention": brain.decision.wantsAttention };
  return (
    <main className="home-page" ref={stageRef} style={style} data-active={running} data-enrollment={enrollment.phase} data-enrollment-focused={enrollmentFocused} onPointerDown={handleStagePointerDown}>
      <section className="intro-copy" aria-hidden={enrollment.isOpen} inert={enrollment.isOpen}>
        <h1 id={active && !enrollment.isOpen ? "page-title" : "home-title"} data-page-route="/" tabIndex={-1}>{t.title} <em>{t.titleAccent}</em></h1>
      </section>
      <m.section className="creature-zone" aria-label={t.creature} layout={!enrollmentMotion.reduced} layoutDependency={`${enrollment.isOpen}-${enrollmentFocused}`} transition={enrollmentMotion.scene}>
        <div className="creature-presence" ref={creatureShellRef}>
          <Suspense fallback={null}><Character ref={characterRef} onReady={wakeCharacter} onPainted={revealCharacter} onError={characterFailed} active={running} voice /></Suspense>
        </div>
        <CreatureLoader visible={!characterRevealed && characterStatus !== "error"} active={running} reduced={reducedMotion} />
        {running && (enrollment.phase === "editing" || enrollment.phase === "confirmed") && <EnrollmentParticles key={enrollment.phase} duration={enrollmentMotion.burst} celebrate={enrollment.phase === "confirmed"} />}
      </m.section>
      {enrollment.isOpen && <EnrollmentExperience session={enrollment} language={language} characterFailed={characterStatus === "error"} onFieldFocus={setEnrollmentFocused} />}
      <div className="home-controls" inert={enrollment.isOpen} aria-hidden={enrollment.isOpen}>
        <div className="speech-slot">
          {!brain.speechNotice && <AnimatePresence mode="wait">
            {brain.speechCaption && <SpeechCaption key={brain.speechCaption.generation} {...brain.speechCaption} onRevealed={brain.onSpeechCaptionRevealed} />}
          </AnimatePresence>}
        </div>
        <m.div className="interaction-dock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition}>
          <ContextWhisper context={brain.userContext} onSubmit={submitContext} onClear={brain.clearContext} status={brain.status} />
          <BrainHUD decision={brain.decision} status={brain.status} personality={brain.personality} speechNotice={brain.speechNotice} decisionInterrupted={brain.decisionInterrupted} />
        </m.div>
        <footer className="home-footer"><button type="button" onClick={() => setDebugActive((value) => !value)} aria-expanded={debugActive}>{t.diagnostics} <span aria-hidden="true">↗</span></button></footer>
      </div>
      <DebugPanel active={debugActive && conversational} getSnapshot={sensors.getSnapshot} personality={brain.personality} decision={brain.decision} latencyMs={brain.apiLatencyMs} onState={brain.forceState} onClose={() => setDebugActive(false)} />
    </main>
  );
}
