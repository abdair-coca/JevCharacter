import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { BRAIN_CONFIG } from "../creature/brain/brainConfig";

type Props = {
  context: string;
  onSubmit: (context: string) => void;
  onClear: () => void;
  onThought: () => void;
};

const PLACEHOLDERS = [
  "I'm your creator.",
  "I just came back after a long day.",
  "I'm trying to scare you.",
  "You haven't seen me in weeks.",
  "I'm your friend.",
  "Today I'm really happy.",
];

export default function ContextWhisper({ context, onSubmit, onClear, onThought }: Props) {
  const [value, setValue] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [received, setReceived] = useState(false);
  const receivedTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % PLACEHOLDERS.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (receivedTimer.current !== null) window.clearTimeout(receivedTimer.current);
    },
    [],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = value.trim();
    if (!next) return;
    onSubmit(next);
    onThought();
    setValue("");
    setReceived(true);
    if (receivedTimer.current !== null) window.clearTimeout(receivedTimer.current);
    receivedTimer.current = window.setTimeout(() => setReceived(false), 1300);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") event.currentTarget.blur();
  };

  return (
    <div className="whisper-wrap">
      <form className={`whisper ${received ? "whisper--received" : ""}`} onSubmit={submit}>
        <span className="whisper__sigil" aria-hidden="true">✦</span>
        <label className="sr-only" htmlFor="creature-context">Give the creature context</label>
        <input
          id="creature-context"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={BRAIN_CONFIG.contextMaxLength}
          placeholder={`Give it context…  ${PLACEHOLDERS[placeholderIndex]}`}
          autoComplete="off"
          spellCheck="true"
        />
        {value.length > BRAIN_CONFIG.contextMaxLength - 45 && (
          <span className="whisper__count" aria-live="polite">
            {BRAIN_CONFIG.contextMaxLength - value.length}
          </span>
        )}
        <button
          className="whisper__send"
          type="submit"
          disabled={!value.trim()}
          aria-label="Send context to the creature"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 10h11M11 6l4 4-4 4" />
          </svg>
        </button>
        <span className="whisper__pulse" aria-hidden="true" />
      </form>
      <div className="whisper__meta">
        <span>What it knows changes how it behaves.</span>
        {context && (
          <button type="button" onClick={onClear} aria-label="Clear stored context">
            <span className="memory-dot" aria-hidden="true" />
            Context held · clear
          </button>
        )}
      </div>
    </div>
  );
}
