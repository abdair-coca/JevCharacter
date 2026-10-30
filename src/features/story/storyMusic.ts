import { appAudio, compactAudio, type AudioCore } from "../../lib/audioCore";
import { clamp, particlePhase } from "./particleGeometry";

type Chord = { bass: number; notes: readonly number[]; intensity: number };
type Target = { key: string; chord: Chord };
type Layer = Target & { release: GainNode; sources: OscillatorNode[] };
type Riser = { noise: AudioBufferSourceNode; band: BiquadFilterNode; level: GainNode; tone: OscillatorNode; toneLevel: GainNode };
/** A falling sine: start and end pitch, fall and decay in seconds, peak level. */
type Hit = { from: number; to: number; fall: number; decay: number; level: number };
/**
 * How rich the sound is. The full profile is the approved soundtrack. The compact one (phones and
 * tablets) plays the same music for a small speaker and a slower audio thread: one string per piano
 * note and per pad voice, no felt knock, the bass an octave up instead of a sub, higher drums, a
 * high-pass under what the speaker can play, and more lookahead so a busy frame does not stall it.
 */
type Profile = { compact: boolean; lookahead: number; highpass: number; bass: number; boom: Hit; kick: Hit };
const FULL: Profile = {
  compact: false, lookahead: 0.1, highpass: 0, bass: 0.06,
  boom: { from: 95, to: 30, fall: 1.1, decay: 2.2, level: 0.85 }, kick: { from: 150, to: 42, fall: 0.14, decay: 0.45, level: 0.34 },
};
const COMPACT: Profile = {
  compact: true, lookahead: 0.25, highpass: 110, bass: 0.1,
  boom: { from: 160, to: 65, fall: 0.5, decay: 1.2, level: 0.55 }, kick: { from: 180, to: 75, fall: 0.1, decay: 0.3, level: 0.3 },
};
/** The fill before the climax's phrase turns. */
const TOM: Hit = { from: 120, to: 70, fall: 0.14, decay: 0.4, level: 0.35 };
type Session = {
  profile: Profile;
  /** One panner per position, shared by the piano notes. */
  pans: Map<number, StereoPannerNode>;
  master: GainNode;
  out: GainNode;
  pad: BiquadFilterNode;
  sweep: OscillatorNode;
  riser: Riser;
  layer: Layer;
  retired: Set<Layer>;
  timer: number;
  /** Context time of the next sixteenth note, and its index since the last downbeat. */
  next: number;
  step: number;
};

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** A musical moment the visuals follow; `at` is when it is heard, in performance-clock milliseconds. */
export type StoryPulse = { kind: "note" | "melody" | "kick" | "impact"; strength: number; at: number };

/** An inspiring arc from A minor to C major: vi, IV, I, V and IV, one chord per scene. */
export const SCENE_CHORDS: readonly Chord[] = [
  { bass: 45, notes: [57, 60, 64, 71], intensity: 0.25 }, // Am(add9): the creator, a quiet beginning
  { bass: 41, notes: [53, 57, 60, 67], intensity: 0.42 }, // F(add9): Bob, the first build
  { bass: 48, notes: [55, 60, 64, 74], intensity: 0.6 }, // C(add9): TitiEdu, it grows
  { bass: 43, notes: [55, 59, 62, 64], intensity: 0.78 }, // G6: machine learning, the theme enters
  { bass: 41, notes: [57, 60, 64, 67], intensity: 0.86 }, // Fmaj9: Jev, the star gathers
];
/** The star opening: a suspended dominant that longs to resolve. */
export const LIFT_CHORD: Chord = { bass: 43, notes: [55, 60, 62, 67], intensity: 0.92 };
/** Jev appears: the whole arc resolves into a wide, bright C major. */
export const REVEAL_CHORD: Chord = { bass: 36, notes: [55, 60, 64, 67, 72, 76], intensity: 1 };

// 104 bpm in sixteenths, scheduled a little ahead of the audio clock.
export const STEP_SECONDS = 60 / 104 / 4;
const BAR = 16;
const PHRASE = 32;
const TICK_MS = 25;
/** A step this late was missed by a stalled timer: it is skipped, not played out of time. */
const LATE = 0.02;
const ARP = [0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 4, 3, 2, 1];
/** The hero theme over two bars: [sixteenth, length, chord tone]. It follows each chord. */
const THEME: readonly (readonly [number, number, number])[] = [[0, 6, 0], [6, 2, 1], [8, 8, 2], [16, 6, 3], [22, 2, 2], [24, 8, 1]];
const FILL = [26, 28, 30];

const FADE_IN = 2.5;
const FADE_OUT = 1.2;
const CROSSFADE = 1.6;
const ARRIVAL = 0.12;
const DEPARTURE = 0.7;
/** Impacts closer than this merge, so a fast jump through the story does not rattle; a stronger one still lands. */
const IMPACT_GAP = 0.9;
const CUTOFF = 700;
const CUTOFF_RANGE = 4500;
const PAD_LEVEL = 0.045;
const SUB_LEVEL = 0.075;
/** Harmonics of a hammered string, fundamental first; the filter takes the top off as a note rings. */
const PIANO_HARMONICS = [0, 1, 0.55, 0.3, 0.18, 0.11, 0.07, 0.045, 0.03];
/** The compact piano has no filter, so its wave starts with the top already softened. */
const SOFT_PIANO_HARMONICS = [0, 1, 0.4, 0.16, 0.07, 0.03];
/** One saw stands in for a detuned pair at about the same loudness. */
const SINGLE_STRING = 1.4;
/** A piano note's two strings sit a few cents apart; the theme's a little wider, so it sings over the arpeggio. */
const PIANO_CENTS = 2;
const THEME_CENTS = 3;
const KNOCK = 0.08;

/** The parts of one sixteenth that the visuals follow: shared by the soundtrack and the silent pulse. */
function groove(step: number, intensity: number, energy: number) {
  const beat = step % BAR;
  const phrase = step % PHRASE;
  const every = energy >= 0.55 ? 1 : energy >= 0.35 ? 2 : 4;
  return {
    beat, phrase,
    arp: beat % every === 0,
    kick: intensity >= 0.75 ? beat % 4 === 0 : intensity >= 0.55 ? beat % 8 === 0 : intensity >= 0.4 && beat === 0,
    theme: intensity >= 0.75 ? THEME.filter(([at]) => at === phrase) : [],
  };
}

/** What is heard on one sixteenth; without the theme, each beat's first note carries the melody. */
function pulsesOf({ beat, arp, kick, theme }: ReturnType<typeof groove>, energy: number, impact: number) {
  const pulses: Omit<StoryPulse, "at">[] = [];
  if (impact > 0) pulses.push({ kind: "impact", strength: impact });
  if (arp) pulses.push({ kind: "note", strength: (beat % 4 === 0 ? 1 : 0.7) * (0.5 + 0.5 * energy) });
  for (const [, length] of theme) pulses.push({ kind: "melody", strength: Math.min(1, 0.3 + length / 8) });
  if (theme.length === 0 && arp && beat % 4 === 0) pulses.push({ kind: "melody", strength: 0.6 });
  if (kick) pulses.push({ kind: "kick", strength: 1 });
  return pulses;
}

/**
 * What the scroll means musically: `bloom` grows as the star forms (to 0.5) and opens
 * to reveal Jev (to 1); `rise` builds while particles travel to the next scene and
 * again as the star opens, peaking where the next impact lands.
 */
export function storyCues(progress: number) {
  const phase = particlePhase(progress);
  const star = clamp((progress - 3.55) / 0.87);
  return {
    bloom: star * 0.5 + phase.reveal * 0.5,
    rise: progress < 4 ? phase.morph : clamp((progress - 4.05) / 0.61),
  };
}

/** One-shot envelope: a fast attack and an exponential decay. */
function envelope(context: AudioContext, peak: number, time: number, attack: number, decay: number) {
  const gain = context.createGain();
  // Silent from creation: a source that starts between samples can emit one
  // frame before the first event, and a gain of 1 there clicks.
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  return gain;
}

function filter(context: AudioContext, type: BiquadFilterType, hz: number, time: number, q = 0.8) {
  const node = context.createBiquadFilter();
  node.type = type;
  node.frequency.setValueAtTime(hz, time);
  node.Q.setValueAtTime(q, time);
  return node;
}

/** Plays a source through a chain once and releases every node when it ends. */
function shot(source: AudioScheduledSourceNode, chain: readonly AudioNode[], destination: AudioNode, time: number, stop: number) {
  let node: AudioNode = source;
  for (const next of chain) node = node.connect(next);
  node.connect(destination);
  source.onended = () => { source.disconnect(); for (const next of chain) next.disconnect(); };
  source.start(time);
  source.stop(stop);
}

/**
 * The story's cinematic soundtrack: a piano arpeggio and theme over strings and low
 * drums that grow scene by scene. Scrolling toward the next scene builds a riser; arriving
 * lands an impact on the downbeat with the new chord. The star opens into a resolving
 * climax as Jev is revealed. It plays only while the shared audio core is audible.
 */
export function createStoryMusic(core: AudioCore = appAudio, { compact = compactAudio }: { compact?: () => boolean } = {}) {
  let wanted = false;
  let scene = 0;
  let bloom = 0;
  let rise = 0;
  // After an impact the riser stays quiet until the scroll starts building again.
  let latched = false;
  let pending = 0;
  let lastImpact = -Infinity;
  let lastStrength = 0;
  let session: Session | null = null;
  // Without sound the same grid runs silently on the performance clock, so the visuals keep the rhythm.
  let quiet: { timer: number; next: number; step: number } | null = null;
  const listeners = new Set<(pulse: StoryPulse) => void>();
  let noiseBuffer: { context: AudioContext; buffer: AudioBuffer } | null = null;
  let pianoWaves: { context: AudioContext; full: PeriodicWave; soft: PeriodicWave } | null = null;

  const target = (): Target => bloom >= 0.75 ? { key: "reveal", chord: REVEAL_CHORD }
    : scene === 4 && bloom > 0.55 ? { key: "lift", chord: LIFT_CHORD }
      : { key: `scene-${scene}`, chord: SCENE_CHORDS[scene] };

  function noise(context: AudioContext) {
    if (noiseBuffer?.context !== context) {
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 11;
      for (let index = 0; index < data.length; index++) {
        seed = (seed * 16807) % 2147483647;
        data[index] = seed / 2147483647 * 2 - 1;
      }
      noiseBuffer = { context, buffer };
    }
    const source = context.createBufferSource();
    source.buffer = noiseBuffer.buffer;
    return source;
  }

  function wave(context: AudioContext, soft: boolean) {
    if (pianoWaves?.context !== context) {
      const create = (harmonics: number[]) => context.createPeriodicWave(new Float32Array(harmonics.length), Float32Array.from(harmonics));
      pianoWaves = { context, full: create(PIANO_HARMONICS), soft: create(SOFT_PIANO_HARMONICS) };
    }
    return soft ? pianoWaves.soft : pianoWaves.full;
  }

  /** Panning is linear, so notes summed into one shared panner sound as if each had its own. */
  function panned(context: AudioContext, s: Session, pan: number) {
    let node = s.pans.get(pan);
    if (!node) {
      node = context.createStereoPanner();
      node.pan.setValueAtTime(pan, context.currentTime);
      node.connect(s.out);
      s.pans.set(pan, node);
    }
    return node;
  }

  /** Strings and low end for one chord: detuned saws spread wide, a sub and its octave. */
  function layer(context: AudioContext, s: Pick<Session, "pad" | "profile">, { key, chord }: Target, time: number, attack: number): Layer {
    const fade = context.createGain();
    fade.gain.setValueAtTime(0.0001, time);
    fade.gain.linearRampToValueAtTime(1, time + attack);
    const release = context.createGain();
    fade.connect(release).connect(s.pad);
    const sources: OscillatorNode[] = [];
    const voice = (hz: number, type: OscillatorType, cents: number, level: number, pan: number) => {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(hz, time);
      oscillator.detune.setValueAtTime(cents, time);
      const amp = context.createGain();
      amp.gain.setValueAtTime(level, time);
      const panner = context.createStereoPanner();
      panner.pan.setValueAtTime(pan, time);
      oscillator.connect(amp).connect(panner).connect(fade);
      oscillator.start(time);
      sources.push(oscillator);
    };
    // The strings grow with each scene, so the story swells toward the reveal.
    const swell = 0.5 + 0.7 * chord.intensity;
    for (const [index, note] of chord.notes.entries()) {
      const spread = (index / (chord.notes.length - 1)) * 1.2 - 0.6;
      if (s.profile.compact) voice(midi(note), "sawtooth", 0, PAD_LEVEL * swell * SINGLE_STRING, spread);
      else {
        voice(midi(note), "sawtooth", -7, PAD_LEVEL * swell, spread);
        voice(midi(note), "sawtooth", 7, PAD_LEVEL * swell, -spread);
      }
    }
    // The climax adds high strings an octave above its top voices.
    if (chord.intensity >= 1) for (const note of chord.notes.slice(-3)) voice(midi(note + 12), "sawtooth", 4, PAD_LEVEL * 0.8, 0);
    // A small speaker cannot play the sub: there the bass sounds an octave up, a little louder.
    if (!s.profile.compact) voice(midi(chord.bass), "sine", 0, SUB_LEVEL * swell, 0);
    voice(midi(chord.bass + 12), "triangle", 0, s.profile.bass * swell, 0);
    sources[0].addEventListener("ended", () => { release.disconnect(); });
    return { key, chord, release, sources };
  }

  function retire(s: Session, old: Layer, time: number, seconds: number) {
    s.retired.add(old);
    old.release.gain.setValueAtTime(1, time);
    old.release.gain.linearRampToValueAtTime(0.0001, time + seconds);
    for (const source of old.sources) source.stop(time + seconds + 0.05);
    old.sources[0].addEventListener("ended", () => { s.retired.delete(old); });
  }

  function swap(context: AudioContext, s: Session, time: number, attack: number, release: number) {
    const next = target();
    if (s.layer.key === next.key) return;
    retire(s, s.layer, time, release);
    s.layer = layer(context, s, next, time, attack);
  }

  /** Brightness and riser follow intensity and scroll; impacts reset the riser. */
  function shape(time: number) {
    if (!session) return;
    const { chord } = session.layer;
    const build = latched ? 0 : rise;
    session.pad.frequency.setTargetAtTime(CUTOFF + chord.intensity ** 2 * CUTOFF_RANGE + build * 1500, time, 0.2);
    const { band, level, tone, toneLevel } = session.riser;
    band.frequency.setTargetAtTime(350 + build ** 2 * 6500, time, 0.08);
    level.gain.setTargetAtTime(0.0001 + 0.13 * build ** 2, time, latched ? 0.03 : 0.08);
    tone.frequency.setTargetAtTime(midi(chord.bass + 24) * 2 ** build, time, 0.1);
    toneLevel.gain.setTargetAtTime(0.0001 + 0.04 * build ** 2, time, latched ? 0.03 : 0.08);
  }

  /** A cinematic hit: a deep falling boom, a thud and a long bright wash. */
  function impact(context: AudioContext, s: Session, time: number, strength: number) {
    const { out } = s;
    const { from, to, fall, decay, level } = s.profile.boom;
    const boom = context.createOscillator();
    boom.frequency.setValueAtTime(from, time);
    boom.frequency.exponentialRampToValueAtTime(to, time + fall);
    shot(boom, [envelope(context, level * strength, time, 0.006, decay)], out, time, time + decay + 0.2);
    shot(noise(context), [filter(context, "lowpass", 240, time), envelope(context, 0.5 * strength, time, 0.003, 0.5)], out, time, time + 0.7);
    shot(noise(context), [filter(context, "highpass", 4200, time), envelope(context, 0.12 * strength, time, 0.01, 2.6)], out, time, time + 2.8);
  }

  /**
   * A piano note: two strings through a filter that closes as they ring, a felt knock,
   * a quick drop after the hammer and a long decay that is shorter up the keyboard.
   * The damper stops it when the key is let go after `hold` seconds. The compact
   * profile plays one string with the top already softened, and no knock.
   */
  function piano(context: AudioContext, s: Session, hz: number, time: number, hold: number, level: number, pan: number, brightness: number, cents: number) {
    const ring = clamp(2.6 - Math.log2(hz / 110) * 0.45, 0.6, 3);
    const out = panned(context, s, pan);
    const end = time + hold + 0.4;
    const single = s.profile.compact;
    // Two strings share the note's level; a single one carries it alone.
    const peak = single ? level : level / 2;
    const amp = context.createGain();
    amp.gain.value = 0;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(peak, time + 0.004);
    amp.gain.setTargetAtTime(peak * 0.35, time + 0.004, 0.07);
    amp.gain.setTargetAtTime(0.0001, time + 0.12, ring / 3);
    amp.gain.setTargetAtTime(0.0001, time + hold, 0.06);
    if (single) {
      const string = context.createOscillator();
      string.setPeriodicWave(wave(context, true));
      string.frequency.setValueAtTime(hz, time);
      shot(string, [amp], out, time, end);
      return;
    }
    const tone = filter(context, "lowpass", hz * brightness, time);
    tone.frequency.exponentialRampToValueAtTime(Math.max(hz * 1.5, 300), time + ring);
    const second = context.createOscillator();
    second.setPeriodicWave(wave(context, false));
    second.frequency.setValueAtTime(hz, time);
    second.detune.setValueAtTime(cents, time);
    second.connect(tone);
    second.onended = () => { second.disconnect(); };
    second.start(time);
    second.stop(end);
    const first = context.createOscillator();
    first.setPeriodicWave(wave(context, false));
    first.frequency.setValueAtTime(hz, time);
    first.detune.setValueAtTime(-cents, time);
    shot(first, [tone, amp], out, time, end);
    shot(noise(context), [filter(context, "bandpass", 1200, time, 0.7), envelope(context, peak * KNOCK, time, 0.001, 0.02)], s.out, time, time + 0.05);
  }

  function drum(context: AudioContext, out: AudioNode, time: number, { from, to, fall, decay, level }: Hit) {
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + fall);
    shot(oscillator, [envelope(context, level, time, 0.003, decay)], out, time, time + decay + 0.1);
  }

  function hat(context: AudioContext, out: AudioNode, time: number, level: number) {
    shot(noise(context), [filter(context, "highpass", 7000, time), envelope(context, level, time, 0.001, 0.05)], out, time, time + 0.08);
  }

  function clap(context: AudioContext, out: AudioNode, time: number, level: number) {
    shot(noise(context), [filter(context, "bandpass", 1800, time, 0.9), envelope(context, level, time, 0.002, 0.16)], out, time, time + 0.2);
  }

  function bell(context: AudioContext, out: AudioNode, hz: number, time: number, level: number) {
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(hz, time);
    shot(oscillator, [envelope(context, level, time, 0.005, 1.6)], out, time, time + 1.7);
  }

  /** Everything that lands on one sixteenth, from the chord and energy of that moment. */
  function play(context: AudioContext, s: Session, time: number) {
    let landed = 0;
    if (pending > 0) {
      const strength = pending;
      landed = strength;
      pending = 0;
      s.step = 0;
      lastImpact = time;
      lastStrength = strength;
      latched = true;
      impact(context, s, time, strength);
      swap(context, s, time, ARRIVAL, DEPARTURE);
      shape(time);
    }
    const { chord } = s.layer;
    const { intensity } = chord;
    // Building toward the next scene pushes the groove before the chord arrives.
    const energy = Math.min(1, intensity + (latched ? 0 : rise) * 0.3);
    const step = groove(s.step, intensity, energy);
    const { beat, phrase } = step;
    const [root, third, fifth] = chord.notes;
    const arp = [root, third, fifth, root + 12, third + 12, fifth + 12].map(note => midi(note + 12));
    if (step.arp) {
      const level = (beat % 4 === 0 ? 0.24 : 0.17) * (0.5 + 0.5 * energy);
      const pan = beat % 2 === 0 ? -0.35 : 0.35;
      // Each note is held for a beat, so the arpeggio rings into the next ones.
      piano(context, s, arp[ARP[beat]], time, STEP_SECONDS * 4, level, pan, 2.5 + energy * 5, PIANO_CENTS);
      // A high ostinato an octave up makes the groove shimmer as it grows.
      if (energy >= 0.6) piano(context, s, arp[ARP[beat]] * 2, time, STEP_SECONDS * 2, level * 0.4, -pan, 2 + energy * 3, PIANO_CENTS);
    }
    if (step.kick) drum(context, s.out, time, s.profile.kick);
    // The climax drives on with a backbeat.
    if (intensity >= 1 && beat % 8 === 4) clap(context, s.out, time, 0.2);
    if (intensity >= 0.86 && FILL.includes(phrase)) drum(context, s.out, time, TOM);
    if (intensity >= 0.55 && beat % 2 === 0) piano(context, s, midi(chord.bass + 12), time, STEP_SECONDS * 2, 0.045, 0, 3, PIANO_CENTS);
    if (energy >= 0.6 && (energy >= 0.95 ? beat % 2 === 1 : beat % 4 === 2)) hat(context, s.out, time, 0.09);
    if (intensity >= 0.75) {
      const tones = [...chord.notes].sort((a, b) => a - b).slice(0, 4).map(note => note + 12);
      for (const [, length, tone] of step.theme) {
        const brightness = 3 + intensity * 4;
        const level = intensity >= 1 ? 0.09 : 0.07;
        piano(context, s, midi(tones[tone]), time, length * STEP_SECONDS, level, 0, brightness, THEME_CENTS);
        if (intensity >= 1) piano(context, s, midi(tones[tone] + 12), time, length * STEP_SECONDS, level * 0.65, 0, brightness, THEME_CENTS);
      }
    }
    if (bloom > 0.15 && beat % (bloom > 0.5 ? 2 : 4) === 0) bell(context, s.out, arp[ARP[(beat + 5) % BAR]] * 2, time, 0.02 + bloom * 0.05);
    // Heard at `time` on the audio clock: translated to the performance clock the visuals draw on.
    emit(pulsesOf(step, energy, landed), performance.now() + (time - context.currentTime + (context.outputLatency || 0)) * 1000);
  }

  function emit(pulses: Omit<StoryPulse, "at">[], at: number) {
    for (const pulse of pulses) for (const listener of listeners) listener({ ...pulse, at });
  }

  /** One silent sixteenth: the same impacts and grid as the soundtrack, only as pulses. */
  function hum(q: NonNullable<typeof quiet>, time: number) {
    let landed = 0;
    if (pending > 0) {
      landed = pending;
      pending = 0;
      q.step = 0;
      lastImpact = time;
      lastStrength = landed;
      latched = true;
    }
    const { intensity } = target().chord;
    const energy = Math.min(1, intensity + (latched ? 0 : rise) * 0.3);
    emit(pulsesOf(groove(q.step, intensity, energy), energy, landed), time * 1000);
  }

  function hush() {
    if (!quiet) return;
    window.clearInterval(quiet.timer);
    quiet = null;
  }

  function listen() {
    if (quiet || session || !wanted) return;
    pending = 0;
    lastImpact = -Infinity;
    const q = { timer: 0, next: performance.now() / 1000 + 0.05, step: 0 };
    q.timer = window.setInterval(() => {
      const now = performance.now() / 1000;
      while (q.next < now - LATE) { q.next += STEP_SECONDS; q.step++; }
      while (q.next < now + 0.1) { hum(q, q.next); q.next += STEP_SECONDS; q.step++; }
    }, TICK_MS);
    quiet = q;
  }

  function tick() {
    const context = core.context();
    if (!session || !context) return;
    // A stalled timer (a long frame while scrolling, mostly on phones) drops the steps it missed
    // instead of playing them late in a burst; the grid keeps its place in the bar.
    while (session.next < context.currentTime - LATE) {
      session.next += STEP_SECONDS;
      session.step++;
    }
    while (session.next < context.currentTime + session.profile.lookahead) {
      play(context, session, session.next);
      session.next += STEP_SECONDS;
      session.step++;
    }
  }

  /** Queues an impact on the next sixteenth; the chord changes with it. Heard or silent alike. */
  function request(strength: number) {
    const context = core.context();
    const now = session && context ? context.currentTime : quiet ? performance.now() / 1000 : null;
    if (now === null) return;
    // The reveal's climax is never swallowed by the scene impact just before it.
    if (pending === 0 && now - lastImpact < IMPACT_GAP && strength <= lastStrength) return;
    pending = Math.max(pending, strength);
  }

  function refresh() {
    const context = core.context();
    if (!session || !context) return;
    if (pending === 0) swap(context, session, context.currentTime, CROSSFADE, CROSSFADE);
    shape(context.currentTime);
  }

  function begin() {
    const context = core.context();
    const output = core.bus("music");
    if (session || !context || !output) return;
    hush();
    lastImpact = -Infinity;
    const now = context.currentTime;
    const profile = compact() ? COMPACT : FULL;
    const master = context.createGain();
    if (profile.highpass > 0) master.connect(filter(context, "highpass", profile.highpass, now, 0.7)).connect(output);
    else master.connect(output);
    const out = context.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(1, now + FADE_IN);
    out.connect(master);
    const pad = filter(context, "lowpass", CUTOFF, now);
    pad.connect(out);
    // A very slow sweep keeps the strings alive without drawing attention.
    const sweep = context.createOscillator();
    const depth = context.createGain();
    sweep.frequency.setValueAtTime(0.06, now);
    depth.gain.setValueAtTime(150, now);
    sweep.connect(depth).connect(pad.frequency);
    sweep.start(now);
    const riserNoise = noise(context);
    riserNoise.loop = true;
    const band = filter(context, "bandpass", 350, now, 1.4);
    const level = context.createGain();
    level.gain.setValueAtTime(0.0001, now);
    riserNoise.connect(band).connect(level).connect(out);
    riserNoise.start(now);
    const tone = context.createOscillator();
    tone.type = "sawtooth";
    const toneLevel = context.createGain();
    toneLevel.gain.setValueAtTime(0.0001, now);
    tone.connect(toneLevel).connect(pad);
    tone.start(now);
    const riser = { noise: riserNoise, band, level, tone, toneLevel };
    pending = 0;
    latched = false;
    session = { profile, pans: new Map(), master, out, pad, sweep, riser, layer: layer(context, { pad, profile }, target(), now, FADE_IN), retired: new Set(), timer: 0, next: now + 0.05, step: 0 };
    shape(now);
    session.timer = window.setInterval(tick, TICK_MS);
    tick();
  }

  function end(seconds: number) {
    pending = 0;
    const context = core.context();
    if (!session || !context) { session = null; listen(); return; }
    const ending = session;
    session = null;
    window.clearInterval(ending.timer);
    const now = context.currentTime;
    ending.master.gain.setValueAtTime(1, now);
    ending.master.gain.linearRampToValueAtTime(0.0001, now + seconds);
    const stopAt = now + seconds + 0.05;
    for (const old of [ending.layer, ...ending.retired]) for (const source of old.sources) source.stop(stopAt);
    for (const source of [ending.sweep, ending.riser.noise, ending.riser.tone]) source.stop(stopAt);
    // One-shots already scheduled finish on their own under the fade.
    ending.sweep.addEventListener("ended", () => { ending.master.disconnect(); });
    listen();
  }

  core.subscribe(() => {
    if (wanted && core.audible()) begin();
    else if (!core.audible()) end(0.15);
  });

  return {
    /** The story is on screen: play once audio is allowed. */
    start() { wanted = true; if (core.audible()) begin(); else listen(); },
    /** The story left the screen: fade out. */
    stop() { wanted = false; hush(); end(FADE_OUT); },
    /** A new scene lands an impact: full going forward, softer going back. */
    setScene(index: number) {
      const next = Math.max(0, Math.min(SCENE_CHORDS.length - 1, Math.trunc(index)));
      if (next === scene) return;
      const forward = next > scene;
      scene = next;
      request(forward ? 1 : 0.45);
      refresh();
    },
    setBloom(value: number) {
      const next = clamp(value);
      if (Math.abs(next - bloom) < 0.005) return;
      const revealed = target().key === "reveal";
      bloom = next;
      // The reveal is the climax: the strongest impact of the story.
      if (!revealed && target().key === "reveal") request(1.3);
      refresh();
    },
    setRise(value: number) {
      const next = clamp(value);
      if (latched && next < 0.15) latched = false;
      if (Math.abs(next - rise) < 0.01) return;
      rise = next;
      const context = core.context();
      if (context) shape(context.currentTime);
    },
    playing: () => session !== null,
    /** Follows every heard (or, without sound, silent) note, beat and impact; returns the unsubscribe. */
    onPulse(listener: (pulse: StoryPulse) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type StoryMusic = ReturnType<typeof createStoryMusic>;

/** The story's single soundtrack. */
export const storyMusic = createStoryMusic();
