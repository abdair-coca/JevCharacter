import type { CharacterCue } from "../../character/useCharacterController";
import { appAudio, type AudioCore } from "../../lib/audioCore";
import type { TalkState } from "../brain/brain.types";
import { ACTION_MOTIFS, scoreSpeech, TALK_BABBLE, type VoiceGlide } from "./voiceScore";

type Channel = "action" | "speech";
type Speech = { key: string; voicedUntil: number; offsetEnd: number; timeEnd: number | null; finish: (() => void) | null; timer: number | null };
type EngineOptions = { core?: AudioCore; now?: () => number };

// A talk gesture waits this long for its real text before babbling on its own.
const TALK_TEXT_WAIT_MS = 450;
const SPEECH_RECENT_MS = 1500;
const TALK_STATES: readonly CharacterCue[] = ["Talk", "talkb", "talkc", "talkbc"];
// Timbre: a filtered triangle for a round "oo/ah" body plus a sweet sine octave,
// dry and close. Crisp attacks and fast scoops give the voice its bounce.
const ATTACK = 0.022;
const GLIDE = 0.03;
const SNAP = 0.012;
const RELEASE = 0.03;
const OCTAVE_GAIN = 0.12;
const VOWEL_DARK = 1000;
const VOWEL_BRIGHT = 1300;
const VOWEL_Q = 1.4;
// How far the loudness drops at each syllable seam.
const SEAM_DIP = 0.4;

function isTalk(cue: CharacterCue): cue is TalkState {
  return TALK_STATES.includes(cue);
}

/** Last index where streamed text ends a whole word; later text may still change. */
function voicedBoundary(text: string, complete: boolean) {
  if (complete) return text.length;
  const match = /\s\S*$/u.exec(text);
  return match ? match.index : 0;
}

/**
 * Jev's playful, dry voice on the shared audio core: one channel for action motifs
 * and one for speech. Every scheduled node can be cancelled, so muting, hiding a
 * route or the tab, or replacing speech stops sound.
 */
export function createVoiceEngine({ core = appAudio, now = () => performance.now() }: EngineOptions = {}) {
  let speech: Speech | null = null;
  let lastSpeechAt = -Infinity;
  let talkTimer: number | null = null;
  const nodes: Record<Channel, Set<AudioScheduledSourceNode>> = { action: new Set(), speech: new Set() };

  function clearTalkTimer() {
    if (talkTimer !== null) window.clearTimeout(talkTimer);
    talkTimer = null;
  }

  // Reports the end of a finished reply, once.
  function notifyEnd(current: Speech) {
    current.timer = null;
    const finish = current.finish;
    current.finish = null;
    finish?.();
  }

  // Cuts the current speech. Only `notify` reports its end: a replaced or cancelled reply must not.
  function endSpeech(notify: boolean) {
    silence("speech");
    const current = speech;
    speech = null;
    if (!current) return;
    if (current.timer !== null) window.clearTimeout(current.timer);
    current.timer = null;
    if (notify) notifyEnd(current);
    else current.finish = null;
  }

  function silence(channel: Channel) {
    for (const node of nodes[channel]) {
      try { node.stop(); } catch { /* A node that never started has nothing to stop. */ }
      node.disconnect();
    }
    nodes[channel].clear();
  }

  function schedule(channel: Channel, glides: readonly VoiceGlide[], startAt: number) {
    const context = core.context();
    const output = core.bus("voice");
    if (!context || !output) return;
    for (const glide of glides) {
      const start = startAt + glide.at;
      const end = start + glide.duration;
      const tone = context.createOscillator();
      const octave = context.createOscillator();
      const octaveGain = context.createGain();
      const vowel = context.createBiquadFilter();
      const envelope = context.createGain();
      tone.type = "triangle";
      octave.type = "sine";
      octaveGain.gain.setValueAtTime(OCTAVE_GAIN, start);
      vowel.type = "lowpass";
      vowel.Q.setValueAtTime(VOWEL_Q, start);
      for (const [index, point] of glide.points.entries()) {
        const time = start + point.at * glide.duration;
        const cutoff = VOWEL_DARK + (point.open ?? 0.5) * VOWEL_BRIGHT;
        if (index === 0) {
          tone.frequency.setValueAtTime(point.hz, start);
          octave.frequency.setValueAtTime(point.hz * 2, start);
          vowel.frequency.setValueAtTime(cutoff, start);
        } else {
          // Approach each target smoothly: the tone slides or scoops, it never jumps.
          const pace = point.snap ? SNAP : GLIDE;
          tone.frequency.setTargetAtTime(point.hz, time, pace);
          octave.frequency.setTargetAtTime(point.hz * 2, time, pace);
          if (point.open !== undefined) vowel.frequency.setTargetAtTime(cutoff, time, GLIDE);
        }
      }
      const level = (syllable: number) => glide.gain * (glide.accents?.[syllable] ?? 1);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(level(0), start + Math.min(ATTACK, glide.duration / 3));
      for (const [index, dip] of glide.dips.entries()) {
        const seam = start + dip * glide.duration;
        envelope.gain.setTargetAtTime(level(index) * SEAM_DIP, seam - 0.022, 0.008);
        envelope.gain.setTargetAtTime(level(index + 1), seam + 0.006, 0.012);
      }
      envelope.gain.setTargetAtTime(0.0001, end - RELEASE, RELEASE);
      tone.connect(vowel);
      octave.connect(octaveGain).connect(vowel);
      vowel.connect(envelope).connect(output);
      const sources: AudioScheduledSourceNode[] = [tone, octave];
      if (glide.vibrato) {
        // Vibrato blooms late in the note, like a held, happy sound.
        const lfo = context.createOscillator();
        const depth = context.createGain();
        lfo.frequency.setValueAtTime(glide.vibrato.rate, start);
        depth.gain.setValueAtTime(0, start);
        depth.gain.setValueAtTime(0, start + glide.vibrato.delay * glide.duration);
        depth.gain.linearRampToValueAtTime(glide.vibrato.depth, end);
        lfo.connect(depth).connect(tone.frequency);
        sources.push(lfo);
      }
      for (const source of sources) {
        nodes[channel].add(source);
        source.onended = () => { nodes[channel].delete(source); source.disconnect(); };
        source.start(start);
        source.stop(end + 0.2);
      }
      tone.addEventListener("ended", () => { envelope.disconnect(); vowel.disconnect(); octaveGain.disconnect(); });
    }
  }

  function babble(state: TalkState) {
    const context = core.context();
    if (!core.audible() || !context) return;
    silence("speech");
    schedule("speech", scoreSpeech(TALK_BABBLE[state]), context.currentTime + 0.02);
  }

  const engine = {
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
      const context = core.context();
      if (!core.audible() || !context) return;
      silence("action");
      // A new action replaces speech; a tap while talking does not.
      if (cue !== "bump") engine.stopSpeech();
      schedule("action", ACTION_MOTIFS[cue], context.currentTime + 0.01);
    },
    /**
     * Voices streamed text once: only whole words until the text is complete. A complete
     * reply reports its end through `onEnd` once its last syllable has sounded, or at once
     * when nothing sounds (muted or without audio).
     */
    speak(key: string, text: string, complete: boolean, onEnd?: () => void) {
      lastSpeechAt = now();
      clearTalkTimer();
      if (speech?.key !== key) {
        endSpeech(false);
        speech = { key, voicedUntil: 0, offsetEnd: 0, timeEnd: null, finish: null, timer: null };
      }
      const context = core.context();
      if (!core.audible() || !context) {
        if (complete) onEnd?.();
        return;
      }
      const boundary = voicedBoundary(text, complete);
      const current = speech;
      const pending = scoreSpeech(text, complete).filter(glide => glide.end > current.voicedUntil && glide.end <= boundary);
      current.voicedUntil = Math.max(current.voicedUntil, boundary);
      if (pending.length > 0) {
        const first = pending[0].at;
        const earliest = context.currentTime + 0.03;
        // Keep the score's own rhythm while text streams faster than it is voiced.
        const start = current.timeEnd === null ? earliest : Math.max(earliest, current.timeEnd + first - current.offsetEnd);
        schedule("speech", pending, start - first);
        const last = pending.reduce((latest, glide) => Math.max(latest, glide.at + glide.duration), 0);
        current.offsetEnd = last;
        current.timeEnd = start - first + last;
      }
      if (!complete) return;
      if (current.timer !== null) window.clearTimeout(current.timer);
      current.finish = onEnd ?? null;
      const remainingMs = current.timeEnd === null ? 0 : Math.max(0, current.timeEnd - context.currentTime) * 1000;
      current.timer = window.setTimeout(() => notifyEnd(current), remainingMs);
    },
    stopSpeech() {
      endSpeech(false);
    },
    stop() {
      clearTalkTimer();
      silence("action");
      endSpeech(true);
    },
  };
  // Muting or hiding the tab silences whatever is still scheduled.
  core.subscribe(() => { if (!core.audible()) engine.stop(); });
  return engine;
}

export type VoiceEngine = ReturnType<typeof createVoiceEngine>;

/** The single voice shared by every Jev that is allowed to sound. */
export const jevVoice = createVoiceEngine();
