import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { CharacterController } from "../character/useCharacterController";
import type { TalkState } from "../creature/brain/brain.types";
import { historyReply, type SpeechBlock } from "../creature/brain/speechBlocks";
import { streamSpeechReply } from "../creature/brain/speechClient";
import { addMemory, readMemory, selectRelevant } from "../creature/memory/memoryStore";
import { SPEECH_HISTORY_LIMIT, SPEECH_MESSAGE_MAX_CHARS, SPEECH_REQUEST_TIMEOUT_MS, type SpeechExchange, type SpeechLanguage } from "../creature/brain/speechProtocol";

export type SpeechNotice = "unavailable" | "regenerating" | "interrupted" | null;
export type SpeechCaption = { text: string; complete: boolean; generation: number; language: SpeechLanguage };
/** A reply with blocks, kept until dismissed or replaced; `complete` once the stream has ended. */
export type SpeechDetail = { spoken: string; blocks: SpeechBlock[]; complete: boolean; generation: number; language: SpeechLanguage };
type PendingSpeech = { message: string; state: TalkState; language: SpeechLanguage; controller: AbortController; generation: number; timeout: number | null; spoken: string; dismissed: boolean };

/** Owns the speech generation, the bounded session history and the notes Jev keeps between visits. */
export function useSpeechSession(characterRef: RefObject<CharacterController | null>, language: SpeechLanguage, active: boolean) {
  const [caption, setCaption] = useState<SpeechCaption | null>(null);
  const [detail, setDetail] = useState<SpeechDetail | null>(null);
  const [notice, setNotice] = useState<SpeechNotice>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "streaming">("idle");
  const historyRef = useRef<SpeechExchange[]>([]);
  const pendingRef = useRef<PendingSpeech | null>(null);
  const generationRef = useRef(0);
  const languageRef = useRef(language);
  const activeRef = useRef(active);
  const fadeTimerRef = useRef<number | null>(null);
  const talkingRef = useRef(false);

  // Returns Jev to Base only when this session is the one holding the talk state.
  const releaseTalk = useCallback(() => {
    if (!talkingRef.current) return;
    talkingRef.current = false;
    void characterRef.current?.idle();
  }, [characterRef]);

  const invalidate = useCallback(() => {
    generationRef.current++;
    const previous = pendingRef.current;
    pendingRef.current = null;
    if (previous?.timeout !== null && previous?.timeout !== undefined) window.clearTimeout(previous.timeout);
    previous?.controller.abort();
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = null;
    releaseTalk();
  }, [releaseTalk]);

  const cancel = useCallback((clearHistory = false) => {
    invalidate();
    if (clearHistory) historyRef.current = [];
    setCaption(null);
    setDetail(null);
    setNotice(null);
    setStatus("idle");
  }, [invalidate]);

  const start = useCallback((message: string, state: TalkState, regenerating = false) => {
    if (!activeRef.current || !message.trim()) return;
    invalidate();
    const request: PendingSpeech = {
      message: message.slice(0, SPEECH_MESSAGE_MAX_CHARS), state,
      language: languageRef.current, controller: new AbortController(),
      generation: generationRef.current, timeout: null, spoken: "", dismissed: false,
    };
    pendingRef.current = request;
    setCaption(null);
    setDetail(null);
    setNotice(regenerating ? "regenerating" : null);
    setStatus("waiting");
    if (regenerating) void characterRef.current?.think();

    const isCurrent = () => pendingRef.current === request && activeRef.current && !request.controller.signal.aborted;
    const fail = () => {
      if (!isCurrent()) return;
      invalidate();
      setCaption(null);
      setDetail(null);
      setNotice("unavailable");
      setStatus("idle");
      void characterRef.current?.idle();
    };
    request.timeout = window.setTimeout(fail, SPEECH_REQUEST_TIMEOUT_MS);
    void streamSpeechReply({
      message: request.message,
      language: request.language,
      history: historyRef.current.slice(-SPEECH_HISTORY_LIMIT),
      memory: selectRelevant(readMemory(), request.message),
      signal: request.controller.signal,
      // The spoken sentence arrives whole: Jev talks while the blocks keep streaming.
      onSpoken: text => {
        if (!isCurrent()) return;
        request.spoken = text;
        talkingRef.current = true;
        void characterRef.current?.speak(request.state);
        setNotice(null);
        setStatus("streaming");
        setCaption({ text, complete: true, generation: request.generation, language: request.language });
      },
      onBlock: block => {
        if (!isCurrent() || request.dismissed) return;
        setDetail(current => ({
          spoken: request.spoken,
          blocks: [...(current?.generation === request.generation ? current.blocks : []), block],
          complete: false, generation: request.generation, language: request.language,
        }));
      },
    }).then(reply => {
      if (!isCurrent()) return;
      if (request.timeout !== null) window.clearTimeout(request.timeout);
      pendingRef.current = null;
      // The voice reports the end of a finished reply through finishTalk.
      historyRef.current = [...historyRef.current, { user: request.message, assistant: historyReply(reply) }].slice(-SPEECH_HISTORY_LIMIT);
      // Only a finished reply is remembered; cancelled or failed ones leave no note.
      if (reply.memory) addMemory(reply.memory);
      setStatus("idle");
      if (!request.dismissed) setDetail(reply.blocks.length > 0 ? { spoken: reply.spoken, blocks: reply.blocks, complete: true, generation: request.generation, language: request.language } : null);
    }).catch(fail);
  }, [characterRef, invalidate]);

  // Closing a reply hides it without cancelling the voice; its late blocks are ignored.
  const dismissDetail = useCallback((generation: number) => {
    const pending = pendingRef.current;
    if (pending?.generation === generation) pending.dismissed = true;
    setDetail(current => current?.generation === generation ? null : current);
    setCaption(current => current?.generation === generation ? null : current);
  }, []);

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
      setDetail(null);
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

  return { caption, detail, notice, status, start, cancel, dismissDetail, onCaptionRevealed, finishTalk: releaseTalk };
}
