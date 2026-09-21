import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import Character from "./components/Character";
import AmbientStage from "./components/AmbientStage";
import BrainHUD from "./components/BrainHUD";
import ContextWhisper from "./components/ContextWhisper";
import DebugPanel from "./components/DebugPanel";

import type {
  CharacterController,
} from "./character/useCharacterController";
import { useCreatureBrain } from "./hooks/useCreatureBrain";
import { usePointerSensor } from "./creature/sensors/pointerSensor";

import "./App.css";

type StageStyle = CSSProperties & {
  "--intensity": number;
  "--attention": number;
};

export default function App() {
  const stageRef = useRef<HTMLElement | null>(null);
  const creatureShellRef = useRef<HTMLDivElement | null>(null);
  const characterRef = useRef<CharacterController | null>(null);
  const [debugActive, setDebugActive] = useState(false);
  const [thoughtPulse, setThoughtPulse] = useState(0);
  const wakePlayedRef = useRef(false);
  const sensors = usePointerSensor(stageRef, creatureShellRef);
  const brain = useCreatureBrain(sensors, characterRef);

  const wakeCharacter = useCallback(() => {
    if (wakePlayedRef.current) return;
    wakePlayedRef.current = true;
    void characterRef.current?.playFor("Hello", 1900);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (event.key.toLowerCase() === "d") setDebugActive((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const stageStyle: StageStyle = {
    "--intensity": brain.decision.intensity,
    "--attention": brain.decision.wantsAttention,
  };

  return (
    <main className="stage" ref={stageRef} style={stageStyle}>
      <AmbientStage
        intensity={brain.decision.intensity}
        wantsAttention={brain.decision.wantsAttention}
      />

      <header className="site-header">
        <div className="brand-mark" aria-label="Jevling">
          <span className="brand-mark__glyph" aria-hidden="true"><i /><i /></span>
          <span>JEVLING</span>
        </div>
        <div className={`brain-link ${brain.status === "deciding" ? "brain-link--deciding" : ""}`}>
          <span />
          {brain.status === "deciding"
            ? "OBSERVING"
            : brain.decision.source === "jev"
              ? "JEV ONLINE"
              : "LOCAL INSTINCT"}
        </div>
      </header>

      <section className="intro-copy" aria-label="Jevling introduction">
        <p>JEVLING</p>
        <h1>Tiny creature. <em>Big decisions.</em></h1>
      </section>

      <section className="creature-zone" aria-label="Interactive digital creature">
        <div
          className={`creature-presence ${brain.decision.wantsAttention > 0.62 ? "creature-presence--seeking" : ""}`}
          ref={creatureShellRef}
        >
          <div className="creature-presence__aura" aria-hidden="true" />
          <div className="creature-presence__ring creature-presence__ring--one" aria-hidden="true" />
          <div className="creature-presence__ring creature-presence__ring--two" aria-hidden="true" />
          <div className="creature-presence__shadow" aria-hidden="true" />
          <Character ref={characterRef} onReady={wakeCharacter} />
        </div>
      </section>

      {thoughtPulse > 0 && (
        <div key={thoughtPulse} className="thought-transfer" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </div>
      )}

      <div className="interaction-dock">
        <ContextWhisper
          context={brain.userContext}
          onSubmit={brain.submitContext}
          onClear={brain.clearContext}
          onThought={() => setThoughtPulse((current) => current + 1)}
        />
      </div>

      <BrainHUD
        decision={brain.decision}
        status={brain.status}
        personality={brain.personality}
      />

      <DebugPanel
        active={debugActive}
        getSnapshot={sensors.getSnapshot}
        personality={brain.personality}
        decision={brain.decision}
        latencyMs={brain.apiLatencyMs}
        onReaction={brain.forceReaction}
        onClose={() => setDebugActive(false)}
      />

      <span className="debug-hint" aria-hidden="true">D / DIAGNOSTICS</span>
    </main>
  );
}
