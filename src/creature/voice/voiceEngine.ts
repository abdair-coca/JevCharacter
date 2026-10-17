import type { CharacterCue } from "../../character/useCharacterController";
import type { TalkState } from "../brain/brain.types";
import { ACTION_MOTIFS, scoreSpeech, TALK_BABBLE, type VoiceNote } from "./voiceScore";

type Channel = "action" | "speech";
type Speech = { key: string; voicedUntil: number; offsetEnd: number; timeEnd: number | null };
type EngineOptions = {
  createContext?: () => AudioContext | null;
  now?: () => number;
};

const MASTER_GAIN = 0.22;
// A talk gesture waits this long for its real text before babbling on its own.
const TALK_TEXT_WAIT_MS = 450;
const SPEECH_RECENT_MS = 1500;
const TALK_STATES: readonly CharacterCue[] = ["Talk", "talkb", "talkc", "talkbc"];

function isTalk(cue: CharacterCue): cue is TalkState {
  return TALK_STATES.includes(cue);
}

function defaultContext() {
  return typeof AudioContext === "undefined" ? null : new AudioContext({ latencyHint: "interactive" });
}

/** Last index where streamed text ends a whole word; later text may still change. */
function voicedBoundary(text: string, complete: boolean) {
  if (complete) return text.length;
  const match = /\s\S*$/u.exec(text);
  return match ? match.index : 0;
}

/**
 * Owns Jev's synthesized voice: an AudioContext created on the first user gesture,
 * one channel for action motifs and one for speech. Every scheduled node can be
 * cancelled, so muting, hiding a route or the tab, or replacing speech stops sound.
 */
export function createVoiceEngine({ createContext = defaultContext, now = () => performance.now() }: EngineOptions = {}) {
  let context: AudioContext | null = null;
  let output: GainNode | null = null;
  let enabled = true;
  let hidden = false;
  let speech: Speech | null = null;
  let lastSpeechAt = -Infinity;
  let talkTimer: number | null = null;
  const nodes: Record<Channel, Set<AudioScheduledSourceNode>> = { action: new Set(), speech: new Set() };

  const audible = () => enabled && !hidden && context !== null && context.state !== "closed";

  function clearTalkTimer() {
    if (talkTimer !== null) window.clearTimeout(talkTimer);
    talkTimer = null;
  }

  function silence(channel: Channel) {
    for (const node of nodes[channel]) {
      try { node.stop(); } catch { /* A node that never started has nothing to stop. */ }
      node.disconnect();
    }
    nodes[channel].clear();
  }

  function schedule(channel: Channel, notes: readonly VoiceNote[], startAt: number) {
    if (!context || !output) return;
    for (const note of notes) {
      const start = startAt + note.at;
      const end = start + note.duration;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = note.wave;
      oscillator.frequency.setValueAtTime(note.from, start);
      if (note.to !== note.from) oscillator.frequency.exponentialRampToValueAtTime(note.to, end);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(note.gain, start + Math.min(0.012, note.duration / 3));
      envelope.gain.setValueAtTime(note.gain, start + note.duration * 0.7);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(envelope).connect(output);
      const sources: AudioScheduledSourceNode[] = [oscillator];
      if (note.vibrato) {
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.frequency.setValueAtTime(note.vibrato.rate, start);
        depth.gain.setValueAtTime(note.vibrato.depth, start);
        lfo.connect(depth).connect(oscillator.frequency);
        sources.push(lfo);
      }
      for (const source of sources) {
        nodes[channel].add(source);
        source.onended = () => { nodes[channel].delete(source); source.disconnect(); };
        source.start(start);
        source.stop(end + 0.02);
      }
      oscillator.addEventListener("ended", () => envelope.disconnect());
    }
  }

  function babble(state: TalkState) {
    if (!audible() || !context) return;
    silence("speech");
    schedule("speech", scoreSpeech(TALK_BABBLE[state]), context.currentTime + 0.02);
  }

  const engine = {
    /** Called from a user gesture: browsers only allow audio to start there. */
    unlock() {
      if (!enabled) return;
      if (!context) {
        try { context = createContext(); } catch { context = null; }
        if (!context) return;
        const compressor = context.createDynamicsCompressor();
        output = context.createGain();
        output.gain.setValueAtTime(MASTER_GAIN, context.currentTime);
        output.connect(compressor).connect(context.destination);
      }
      if (context.state === "suspended" && !hidden) void context.resume().catch(() => {});
    },
    unlocked: () => context !== null,
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) engine.stop();
    },
    setHidden(value: boolean) {
      hidden = value;
      if (value) {
        engine.stop();
        if (context?.state === "running") void context.suspend().catch(() => {});
      } else if (context?.state === "suspended" && enabled) void context.resume().catch(() => {});
    },
    cue(cue: CharacterCue) {
      if (cue === "Base") return;
      if (isTalk(cue)) {
        clearTalkTimer();
        talkTimer = window.setTimeout(() => {
          talkTimer = null;
          if (speech === null && now() - lastSpeechAt > SPEECH_RECENT_MS) babble(cue);
        }, TALK_TEXT_WAIT_MS);
        return;
      }
      if (!audible() || !context) return;
      silence("action");
      // A new action replaces speech; a tap while talking does not.
      if (cue !== "bump") engine.stopSpeech();
      schedule("action", ACTION_MOTIFS[cue], context.currentTime + 0.01);
    },
    /** Voices streamed text once: only whole words until the text is complete. */
    speak(key: string, text: string, complete: boolean) {
      lastSpeechAt = now();
      clearTalkTimer();
      if (speech?.key !== key) {
        silence("speech");
        speech = { key, voicedUntil: 0, offsetEnd: 0, timeEnd: null };
      }
      if (!audible() || !context) return;
      const boundary = voicedBoundary(text, complete);
      const current = speech;
      const pending = scoreSpeech(text, complete).filter(note => note.end > current.voicedUntil && note.end <= boundary);
      current.voicedUntil = Math.max(current.voicedUntil, boundary);
      if (pending.length === 0) return;
      const first = pending[0].at;
      const earliest = context.currentTime + 0.03;
      // Keep the score's own rhythm while text streams faster than it is voiced.
      const start = current.timeEnd === null ? earliest : Math.max(earliest, current.timeEnd + first - current.offsetEnd);
      schedule("speech", pending, start - first);
      const last = pending.reduce((latest, note) => Math.max(latest, note.at + note.duration), 0);
      current.offsetEnd = last;
      current.timeEnd = start - first + last;
    },
    stopSpeech() {
      silence("speech");
      speech = null;
    },
    stop() {
      clearTalkTimer();
      silence("action");
      engine.stopSpeech();
    },
  };
  return engine;
}

export type VoiceEngine = ReturnType<typeof createVoiceEngine>;

/** The single voice shared by every Jev that is allowed to sound. */
export const jevVoice = createVoiceEngine();
