import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { CharacterController } from "../character/useCharacterController";
import type { TalkState } from "../creature/brain/brain.types";
import { streamSpeechReply } from "../creature/brain/speechClient";
import { SPEECH_HISTORY_LIMIT, SPEECH_MESSAGE_MAX_CHARS, SPEECH_REQUEST_TIMEOUT_MS, type SpeechExchange, type SpeechLanguage } from "../creature/brain/speechProtocol";

export type SpeechNotice = "unavailable" | "regenerating" | "interrupted" | null;
export type SpeechCaption = { text: string; complete: boolean; generation: number; language: SpeechLanguage };
type PendingSpeech = { message: string; state: TalkState; language: SpeechLanguage; controller: AbortController; generation: number; timeout: number | null };

/** Owns only the speech generation and bounded, in-memory conversation history. */
export function useSpeechSession(characterRef: RefObject<CharacterController | null>, language: SpeechLanguage, active: boolean) {
  const [caption, setCaption] = useState<SpeechCaption | null>(null);
  const [notice, setNotice] = useState<SpeechNotice>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "streaming">("idle");
  const historyRef = useRef<SpeechExchange[]>([]);
  const pendingRef = useRef<PendingSpeech | null>(null);
  const generationRef = useRef(0);
  const languageRef = useRef(language);
  const activeRef = useRef(active);
  const fadeTimerRef = useRef<number | null>(null);

  const invalidate = useCallback(() => {
    generationRef.current++;
    const previous = pendingRef.current;
    pendingRef.current = null;
    if (previous?.timeout !== null && previous?.timeout !== undefined) window.clearTimeout(previous.timeout);
    previous?.controller.abort();
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = null;
  }, []);

  const cancel = useCallback((clearHistory = false) => {
    invalidate();
    if (clearHistory) historyRef.current = [];
    setCaption(null);
    setNotice(null);
    setStatus("idle");
  }, [invalidate]);

  const start = useCallback((message: string, state: TalkState, regenerating = false) => {
    if (!activeRef.current || !message.trim()) return;
    invalidate();
    const request: PendingSpeech = {
      message: message.slice(0, SPEECH_MESSAGE_MAX_CHARS), state,
      language: languageRef.current, controller: new AbortController(),
      generation: generationRef.current, timeout: null,
    };
    pendingRef.current = request;
    setCaption(null);
    setNotice(regenerating ? "regenerating" : null);
    setStatus("waiting");
    if (regenerating) void characterRef.current?.think();

    const isCurrent = () => pendingRef.current === request && activeRef.current && !request.controller.signal.aborted;
    const fail = () => {
      if (!isCurrent()) return;
      invalidate();
      setCaption(null);
      setNotice("unavailable");
      setStatus("idle");
      void characterRef.current?.idle();
    };
    request.timeout = window.setTimeout(fail, SPEECH_REQUEST_TIMEOUT_MS);
    let talking = false;
    void streamSpeechReply({
      message: request.message,
      language: request.language,
      history: historyRef.current.slice(-SPEECH_HISTORY_LIMIT),
      signal: request.controller.signal,
      onText: text => {
        if (!isCurrent()) return;
        if (!talking) {
          talking = true;
          void characterRef.current?.talk(request.state);
        }
        setNotice(null);
        setStatus("streaming");
        setCaption({ text, complete: false, generation: request.generation, language: request.language });
      },
    }).then(text => {
      if (!isCurrent()) return;
      if (request.timeout !== null) window.clearTimeout(request.timeout);
      pendingRef.current = null;
      historyRef.current = [...historyRef.current, { user: request.message, assistant: text }].slice(-SPEECH_HISTORY_LIMIT);
      setStatus("idle");
      setCaption({ text, complete: true, generation: request.generation, language: request.language });
    }).catch(fail);
  }, [characterRef, invalidate]);

  const onCaptionRevealed = useCallback((generation: number) => {
    if (generation !== generationRef.current || !activeRef.current) return;
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setCaption(current => current?.generation === generation ? null : current);
      fadeTimerRef.current = null;
    }, 5000);
  }, []);

  // Suspend before applying locale changes: changing preferences on another route
  // must never start an invisible replacement request.
  useLayoutEffect(() => {
    activeRef.current = active;
    if (!active) {
      const interrupted = pendingRef.current !== null;
      invalidate();
      setCaption(null);
      setStatus("idle");
      setNotice(interrupted ? "interrupted" : null);
    }
  }, [active, invalidate]);

  useLayoutEffect(() => {
    languageRef.current = language;
    const pending = pendingRef.current;
    if (pending && pending.language !== language && activeRef.current) start(pending.message, pending.state, true);
  }, [language, start]);

  useLayoutEffect(() => () => {
    activeRef.current = false;
    invalidate();
  }, [invalidate]);

  return { caption, notice, status, start, cancel, onCaptionRevealed };
}
