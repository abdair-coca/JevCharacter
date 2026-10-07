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
import { executeDecisionAction } from "../creature/rive/riveReactionAdapter";
import type { SpeechCaption as Caption } from "../hooks/useSpeechSession";

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
  const stageRef = useRef<HTMLElement | null>(null);
  const creatureShellRef = useRef<HTMLDivElement | null>(null);
  const characterRef = useRef<CharacterController | null>(null);
  const [debugActive, setDebugActive] = useState(false);
  const wakePlayedRef = useRef(false);
  const sensors = usePointerSensor(stageRef, creatureShellRef, running, active);
  const brain = useCreatureBrain(sensors, characterRef, { active: running, language });

  const handleStagePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!running) return;
    const target = event.target;
    if (target instanceof HTMLCanvasElement) return;
    if (target instanceof Element && target.closest("button, input, textarea, select, a, label, [role='button']")) return;
    void characterRef.current?.bump();
  }, [running]);
  const wakeCharacter = useCallback(() => {
    if (wakePlayedRef.current || !running) return;
    wakePlayedRef.current = true;
    if (brain.status === "deciding") void characterRef.current?.think();
    else if (!brain.userContext) void characterRef.current?.playFor("Hello", 1900);
    else if (brain.decision.action.kind !== "talk") void executeDecisionAction(characterRef.current, brain.decision);
    else if (brain.speechCaption?.text) void characterRef.current?.talk(brain.decision.action.state);
  }, [brain.decision, brain.speechCaption, brain.status, brain.userContext, running]);
  useEffect(() => {
    if (!running) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "d") setDebugActive((value) => !value);
      if (event.key === "Escape") setDebugActive(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running]);

  const style: StageStyle = { "--intensity": brain.decision.intensity, "--attention": brain.decision.wantsAttention };
  return (
    <main className="home-page" ref={stageRef} style={style} data-active={running} onPointerDown={handleStagePointerDown}>
      <section className="intro-copy">
        <h1 id={active ? "page-title" : "home-title"} data-page-route="/" tabIndex={-1}>{t.title} <em>{t.titleAccent}</em></h1>
        <p>{t.intro}</p>
      </section>
      <section className="creature-zone" aria-label={t.creature}>
        <div className="creature-presence" ref={creatureShellRef}>
          <Suspense fallback={<div className="character-loading" role="status">{t.observing}…</div>}><Character ref={characterRef} onReady={wakeCharacter} active={running} /></Suspense>
        </div>
      </section>
      <div className="home-controls">
        <div className="speech-slot">
          {!brain.speechNotice && <AnimatePresence mode="wait">
            {brain.speechCaption && <SpeechCaption key={brain.speechCaption.generation} {...brain.speechCaption} onRevealed={brain.onSpeechCaptionRevealed} />}
          </AnimatePresence>}
        </div>
        <m.div className="interaction-dock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={transition}>
          <ContextWhisper context={brain.userContext} onSubmit={brain.submitContext} onClear={brain.clearContext} status={brain.status} attention={brain.decision.wantsAttention} />
          <BrainHUD decision={brain.decision} status={brain.status} personality={brain.personality} speechNotice={brain.speechNotice} decisionInterrupted={brain.decisionInterrupted} />
        </m.div>
        <footer className="home-footer"><span>{t.footer}</span><button type="button" onClick={() => setDebugActive((value) => !value)} aria-expanded={debugActive}>{t.diagnostics} <span aria-hidden="true">↗</span></button></footer>
      </div>
      <DebugPanel active={debugActive && running} getSnapshot={sensors.getSnapshot} personality={brain.personality} decision={brain.decision} latencyMs={brain.apiLatencyMs} onState={brain.forceState} onClose={() => setDebugActive(false)} />
    </main>
  );
}
