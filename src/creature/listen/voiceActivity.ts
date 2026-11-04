import { LISTEN_SAMPLE_RATE, LISTEN_SEGMENT_MAX_MS, LISTEN_SPEECH_MIN_MS } from "./listenProtocol";

const FRAME_MS = 20;
const FRAME_SAMPLES = (LISTEN_SAMPLE_RATE * FRAME_MS) / 1000;
/** Kept before the onset so the first syllable is not cut. */
const PRE_ROLL_FRAMES = 300 / FRAME_MS;
/** Voiced frames in a row that open a phrase. */
const ONSET_FRAMES = 3;
/** Silence that closes a phrase. */
const HANGOVER_FRAMES = 700 / FRAME_MS;
/** Silence kept after the last voiced frame. */
const TAIL_FRAMES = 200 / FRAME_MS;
const MAX_FRAMES = LISTEN_SEGMENT_MAX_MS / FRAME_MS;
const MIN_SPEECH_FRAMES = LISTEN_SPEECH_MIN_MS / FRAME_MS;
/** RMS below this is never speech, however quiet the room. */
const LEVEL_FLOOR = 0.01;
const ONSET_OVER_NOISE = 3.2;
// Lower while inside a phrase, so soft word endings do not close it early.
const SUSTAIN_OVER_NOISE = 2.2;
// A voice repeats itself at its pitch; typing, claps, coughs and hiss do not. Whisper turns those into
// invented sentences, so a phrase needs this much repeating sound. Measured 2026-11-03 over 120 phrases in
// 4 voices: the shortest had 4 frames, «Jev» alone 5, and those noises 0.
const MIN_PERIODIC_FRAMES = 3;
const PERIODIC_CORRELATION = 0.7;
// 30 ms compared with itself one period later, for pitches from 400 Hz down to 70 Hz.
const PITCH_WINDOW = (LISTEN_SAMPLE_RATE * 30) / 1000;
const PITCH_MIN_LAG = Math.floor(LISTEN_SAMPLE_RATE / 400);
const PITCH_MAX_LAG = Math.ceil(LISTEN_SAMPLE_RATE / 70);
const PITCH_FRAMES = Math.ceil((PITCH_WINDOW + PITCH_MAX_LAG) / FRAME_SAMPLES);

export type VoiceSegment = { samples: Float32Array; speechMs: number };

function rms(frame: Float32Array) {
  let sum = 0;
  for (const sample of frame) sum += sample * sample;
  return Math.sqrt(sum / frame.length);
}

/** True when the latest frames repeat at some pitch of a voice. */
function repeatsAtPitch(frames: Float32Array[]) {
  const audio = new Float32Array(PITCH_FRAMES * FRAME_SAMPLES);
  frames.slice(-PITCH_FRAMES).forEach((frame, index) => audio.set(frame, index * FRAME_SAMPLES));
  let energy = 0;
  for (let index = 0; index < PITCH_WINDOW; index++) energy += audio[index] * audio[index];
  for (let lag = PITCH_MIN_LAG; lag <= PITCH_MAX_LAG; lag++) {
    let cross = 0;
    let later = 0;
    for (let index = 0; index < PITCH_WINDOW; index++) {
      cross += audio[index] * audio[index + lag];
      later += audio[index + lag] * audio[index + lag];
    }
    if (cross > PERIODIC_CORRELATION * Math.sqrt(energy * later)) return true;
  }
  return false;
}

/**
 * Energy-based phrase detector over 16 kHz audio. The noise estimate follows the room down fast
 * and up slowly, so steady noise stops counting as speech while a voice stands out from it.
 * A closed phrase only counts if part of it repeats at a voice's pitch.
 */
export function createVoiceActivityDetector() {
  let partial = new Float32Array(FRAME_SAMPLES);
  let partialLength = 0;
  // Unset until the first frame: a silent room has a noise of exactly 0.
  let noise: number | null = null;
  let preRoll: Float32Array[] = [];
  let onsetRun = 0;
  let phrase: Float32Array[] | null = null;
  let speechFrames = 0;
  let silenceRun = 0;
  let levelSum = 0;
  let periodicFrames = 0;

  const close = (segments: VoiceSegment[]) => {
    if (phrase && speechFrames >= MIN_SPEECH_FRAMES && periodicFrames >= MIN_PERIODIC_FRAMES) {
      const kept = phrase.slice(0, phrase.length - Math.max(0, silenceRun - TAIL_FRAMES));
      const samples = new Float32Array(kept.length * FRAME_SAMPLES);
      kept.forEach((frame, index) => samples.set(frame, index * FRAME_SAMPLES));
      segments.push({ samples, speechMs: speechFrames * FRAME_MS });
    }
    // A phrase that never paused is usually a noise that just started: it becomes the room's level,
    // so it is sent once, and that level falls back at the next pause if it was a voice after all.
    if (phrase && phrase.length >= MAX_FRAMES) noise = levelSum / phrase.length;
    phrase = null;
    speechFrames = 0;
    silenceRun = 0;
    onsetRun = 0;
    levelSum = 0;
    periodicFrames = 0;
  };

  const pushFrame = (frame: Float32Array, segments: VoiceSegment[]) => {
    const level = rms(frame);
    if (phrase) {
      const voiced = level > Math.max(LEVEL_FLOOR * 0.8, (noise ?? 0) * SUSTAIN_OVER_NOISE);
      phrase.push(frame);
      levelSum += level;
      if (voiced) {
        speechFrames++;
        silenceRun = 0;
        if (periodicFrames < MIN_PERIODIC_FRAMES && repeatsAtPitch(phrase)) periodicFrames++;
      } else {
        silenceRun++;
      }
      if (silenceRun >= HANGOVER_FRAMES || phrase.length >= MAX_FRAMES) close(segments);
      return;
    }
    noise = noise === null ? level : noise + (level - noise) * (level < noise ? 0.2 : 0.01);
    const voiced = level > Math.max(LEVEL_FLOOR, noise * ONSET_OVER_NOISE);
    preRoll.push(frame);
    if (preRoll.length > PRE_ROLL_FRAMES) preRoll.shift();
    onsetRun = voiced ? onsetRun + 1 : 0;
    if (onsetRun >= ONSET_FRAMES) {
      phrase = preRoll;
      preRoll = [];
      speechFrames = onsetRun;
      silenceRun = 0;
    }
  };

  return {
    /** Feeds 16 kHz samples; returns the phrases they closed. */
    push(chunk: Float32Array): VoiceSegment[] {
      const segments: VoiceSegment[] = [];
      let offset = 0;
      while (offset < chunk.length) {
        const count = Math.min(chunk.length - offset, FRAME_SAMPLES - partialLength);
        partial.set(chunk.subarray(offset, offset + count), partialLength);
        partialLength += count;
        offset += count;
        if (partialLength === FRAME_SAMPLES) {
          pushFrame(partial, segments);
          partial = new Float32Array(FRAME_SAMPLES);
          partialLength = 0;
        }
      }
      return segments;
    },
    /** True while a phrase is open. */
    get speaking() {
      return phrase !== null;
    },
  };
}
