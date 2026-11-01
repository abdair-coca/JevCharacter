import { useCallback, useEffect, useRef, useState } from "react";
import { readGroqKey } from "../brain/groqKeyStore";
import { SpeechKeyRequiredError } from "../brain/speechClient";
import type { SpeechLanguage } from "../brain/speechProtocol";
import { MicUnavailableError, micSupported, startMicCapture, type MicCapture } from "./micCapture";
import { TranscribeQuotaError, transcribePhrase } from "./transcribeClient";
import { createVoiceActivityDetector, type VoiceSegment } from "./voiceActivity";
import { encodeWav } from "./wav";
import { matchWakeWord } from "./wakeWord";

/** After Jev finishes talking, the next phrase may answer him without saying his name. */
export const HANDS_FREE_REPLY_WINDOW_MS = 8_000;

export type HandsFreeStatus = "off" | "starting" | "listening" | "hearing" | "transcribing";
export type HandsFreeNotice = "denied" | "noMic" | "unsupported" | "needsKey" | "quota" | null;

type HandsFreeOptions = {
  /** Home is visible and conversational; false switches the microphone off. */
  enabled: boolean;
  /** Jev is deciding or talking: what the microphone hears now is ignored, often his own voice. */
  busy: boolean;
  /** Jev is talking; when it ends, the reply window opens. */
  speaking: boolean;
  language: SpeechLanguage;
  onMessage: (message: string) => void;
  /** Only his name was heard: Jev looks up and waits. */
  onSummoned: () => void;
};

type HeardPhrase = VoiceSegment & { replyWindow: boolean };

/** Hands-free listening: phrases addressed to Jev, by name or inside the reply window, become messages. */
export function useHandsFree({ enabled, busy, speaking, language, onMessage, onSummoned }: HandsFreeOptions) {
  const [phase, setPhase] = useState<"off" | "starting" | "on">("off");
  const [hearing, setHearing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [notice, setNotice] = useState<HandsFreeNotice>(null);
  const [heard, setHeard] = useState("");
  const captureRef = useRef<MicCapture | null>(null);
  const sessionRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const queuedRef = useRef<HeardPhrase | null>(null);
  const replyWindowEndsRef = useRef(0);
  const busyRef = useRef(busy);
  const languageRef = useRef(language);
  const callbacksRef = useRef({ onMessage, onSummoned });

  useEffect(() => {
    busyRef.current = busy;
    languageRef.current = language;
    callbacksRef.current = { onMessage, onSummoned };
  });

  const stop = useCallback(() => {
    sessionRef.current++;
    captureRef.current?.stop();
    captureRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
    queuedRef.current = null;
    replyWindowEndsRef.current = 0;
    setPhase("off");
    setHearing(false);
    setTranscribing(false);
  }, []);

  const deliver = useCallback((transcript: string, phrase: HeardPhrase) => {
    // Jev started deciding or talking meanwhile (a typed message): the phrase is stale.
    if (busyRef.current) return;
    const wake = matchWakeWord(transcript);
    if (wake.addressed && !wake.message) {
      replyWindowEndsRef.current = Date.now() + HANDS_FREE_REPLY_WINDOW_MS;
      callbacksRef.current.onSummoned();
      return;
    }
    const message = wake.addressed ? wake.message : phrase.replyWindow ? transcript : "";
    if (!message) return;
    replyWindowEndsRef.current = 0;
    setHeard(message);
    callbacksRef.current.onMessage(message);
  }, []);

  const transcribe = useCallback(async (phrase: HeardPhrase, session: number) => {
    const controller = new AbortController();
    requestRef.current = controller;
    setTranscribing(true);
    try {
      const transcript = await transcribePhrase({ wav: encodeWav(phrase.samples), language: languageRef.current, apiKey: readGroqKey(), signal: controller.signal });
      if (session !== sessionRef.current) return;
      setNotice(null);
      if (transcript) deliver(transcript, phrase);
    } catch (error) {
      if (session !== sessionRef.current) return;
      if (error instanceof SpeechKeyRequiredError) {
        stop();
        setNotice("needsKey");
        return;
      }
      if (error instanceof TranscribeQuotaError) setNotice("quota");
      // Any other failure drops this phrase; listening goes on.
    }
    if (session !== sessionRef.current) return;
    requestRef.current = null;
    const next = queuedRef.current;
    queuedRef.current = null;
    if (next) void transcribe(next, session);
    else setTranscribing(false);
  }, [deliver, stop]);

  const start = useCallback(async () => {
    if (!readGroqKey()) {
      setNotice("needsKey");
      return;
    }
    if (!micSupported()) {
      setNotice("unsupported");
      return;
    }
    const session = ++sessionRef.current;
    setNotice(null);
    setPhase("starting");
    const detector = createVoiceActivityDetector();
    let discard = false;
    let replyWindow = false;
    try {
      const capture = await startMicCapture(samples => {
        if (session !== sessionRef.current) return;
        const wasHearing = detector.speaking;
        for (const segment of detector.push(samples)) {
          // Anything heard while Jev decided or talked is dropped whole, before it costs quota.
          if (discard || busyRef.current) continue;
          const phrase = { ...segment, replyWindow };
          if (requestRef.current) queuedRef.current = phrase;
          else void transcribe(phrase, session);
        }
        if (!wasHearing && detector.speaking) {
          discard = busyRef.current;
          replyWindow = Date.now() < replyWindowEndsRef.current;
        }
        if (wasHearing !== detector.speaking) setHearing(detector.speaking);
      });
      if (session !== sessionRef.current) {
        capture.stop();
        return;
      }
      captureRef.current = capture;
      setPhase("on");
    } catch (error) {
      if (session !== sessionRef.current) return;
      setPhase("off");
      setNotice(error instanceof MicUnavailableError ? error.reason : "unsupported");
    }
  }, [transcribe]);

  const toggle = useCallback(() => {
    if (phase === "off") {
      void start();
      return;
    }
    stop();
    setNotice(null);
  }, [phase, start, stop]);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => stop, [stop]);

  // The reply window opens when Jev stops talking.
  const wasSpeakingRef = useRef(speaking);
  useEffect(() => {
    if (wasSpeakingRef.current && !speaking && captureRef.current) {
      replyWindowEndsRef.current = Date.now() + HANDS_FREE_REPLY_WINDOW_MS;
    }
    wasSpeakingRef.current = speaking;
  }, [speaking]);

  const status: HandsFreeStatus = phase === "off" ? "off"
    : phase === "starting" ? "starting"
      : hearing ? "hearing"
        : transcribing ? "transcribing"
          : "listening";

  return { status, notice, heard, onToggle: toggle };
}
