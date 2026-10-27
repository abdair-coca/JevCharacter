export type AudioBus = "voice" | "music" | "ui";
type CoreOptions = { createContext?: () => AudioContext | null; compact?: () => boolean };

const MASTER_GAIN = 0.22;
// Interface clicks sit under Jev's voice: they confirm a touch, they never speak over Jev.
const BUS_GAIN: Record<AudioBus, number> = { voice: 1, music: 0.75, ui: 0.5 };
// Only the music sits in the hall; Jev's voice and the interface clicks stay dry and close, with no echo.
const MUSIC_ROOM_SEND = 0.45;
const ROOM_SECONDS = 2.6;
// A phone's convolver tail costs its audio thread the most; a shorter hall keeps the warmth.
const COMPACT_ROOM_SECONDS = 1.4;
// The hall's tail is darkened so it adds warmth, not hiss.
const ROOM_TONE_HZ = 3200;

/**
 * Phones and tablets: small speakers that cannot play deep bass and an audio thread with less room,
 * so the sound takes a lighter path there.
 */
export function compactAudio() {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

function defaultContext() {
  if (typeof AudioContext === "undefined") return null;
  // A slightly larger output buffer on phones trades a few milliseconds for no dropouts.
  return new AudioContext({ latencyHint: compactAudio() ? "balanced" : "interactive" });
}

/** A generated room: decaying stereo noise, so no impulse file is downloaded. */
function room(context: AudioContext, seconds: number) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  const smoothing = 1 - Math.exp(-2 * Math.PI * ROOM_TONE_HZ / context.sampleRate);
  let seed = 7;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let tone = 0;
    for (let index = 0; index < length; index++) {
      seed = (seed * 16807) % 2147483647;
      tone += smoothing * ((seed / 2147483647 * 2 - 1) - tone);
      data[index] = tone * (1 - index / length) ** 3;
    }
  }
  return buffer;
}

/**
 * Owns the single AudioContext shared by Jev's voice, the interface clicks and the story's music: it is
 * created on the first user gesture, follows the sound preference and suspends
 * with the tab. Listeners hear every change so each player can start or stop.
 */
export function createAudioCore({ createContext = defaultContext, compact = compactAudio }: CoreOptions = {}) {
  let context: AudioContext | null = null;
  let buses: Record<AudioBus, GainNode> | null = null;
  let enabled = true;
  let hidden = false;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };

  function build(audio: AudioContext) {
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(MASTER_GAIN, now);
    master.connect(audio.createDynamicsCompressor()).connect(audio.destination);
    const bus = (name: AudioBus) => {
      const node = audio.createGain();
      node.gain.setValueAtTime(BUS_GAIN[name], now);
      node.connect(master);
      return node;
    };
    buses = { voice: bus("voice"), music: bus("music"), ui: bus("ui") };
    const reverb = audio.createConvolver();
    reverb.buffer = room(audio, compact() ? COMPACT_ROOM_SECONDS : ROOM_SECONDS);
    reverb.connect(master);
    const send = audio.createGain();
    send.gain.setValueAtTime(MUSIC_ROOM_SEND, now);
    buses.music.connect(send).connect(reverb);
  }

  return {
    /** Called from a user gesture: browsers only allow audio to start there. */
    unlock() {
      if (!enabled) return;
      if (!context) {
        try { context = createContext(); } catch { context = null; }
        if (!context) return;
        build(context);
      }
      if (context.state === "suspended" && !hidden) void context.resume().catch(() => {});
      notify();
    },
    unlocked: () => context !== null,
    audible: () => enabled && !hidden && context !== null && context.state !== "closed",
    context: () => context,
    bus: (name: AudioBus) => buses?.[name] ?? null,
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value;
      notify();
    },
    setHidden(value: boolean) {
      if (hidden === value) return;
      hidden = value;
      if (value && context?.state === "running") void context.suspend().catch(() => {});
      if (!value && enabled && context?.state === "suspended") void context.resume().catch(() => {});
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type AudioCore = ReturnType<typeof createAudioCore>;

/** The one audio context of the app; players attach to its buses. */
export const appAudio = createAudioCore();
