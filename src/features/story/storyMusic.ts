import { appAudio, type AudioCore } from "../../lib/audioCore";
import { clamp, particlePhase } from "./particleGeometry";

type Chord = { bass: number; notes: readonly number[]; intensity: number };
type Target = { key: string; chord: Chord };
type Layer = Target & { release: GainNode; sources: OscillatorNode[] };
type Riser = { noise: AudioBufferSourceNode; band: BiquadFilterNode; level: GainNode; tone: OscillatorNode; toneLevel: GainNode };
type Session = {
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
const LOOKAHEAD = 0.1;
const TICK_MS = 25;
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
const PLUCK_RING = 0.12;

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
 * The story's cinematic soundtrack: a pulsing arpeggio, low drums and a hero theme
 * that grow scene by scene. Scrolling toward the next scene builds a riser; arriving
 * lands an impact on the downbeat with the new chord. The star opens into a resolving
 * climax as Jev is revealed. It plays only while the shared audio core is audible.
 */
export function createStoryMusic(core: AudioCore = appAudio) {
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
  let noiseBuffer: { context: AudioContext; buffer: AudioBuffer } | null = null;

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

  /** Strings and low end for one chord: detuned saws spread wide, a sub and its octave. */
  function layer(context: AudioContext, s: Pick<Session, "pad">, { key, chord }: Target, time: number, attack: number): Layer {
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
      voice(midi(note), "sawtooth", -7, PAD_LEVEL * swell, spread);
      voice(midi(note), "sawtooth", 7, PAD_LEVEL * swell, -spread);
    }
    // The climax adds high strings an octave above its top voices.
    if (chord.intensity >= 1) for (const note of chord.notes.slice(-3)) voice(midi(note + 12), "sawtooth", 4, PAD_LEVEL * 0.8, 0);
    voice(midi(chord.bass), "sine", 0, SUB_LEVEL * swell, 0);
    voice(midi(chord.bass + 12), "triangle", 0, 0.06 * swell, 0);
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
  function impact(context: AudioContext, out: AudioNode, time: number, strength: number) {
    const boom = context.createOscillator();
    boom.frequency.setValueAtTime(95, time);
    boom.frequency.exponentialRampToValueAtTime(30, time + 1.1);
    shot(boom, [envelope(context, 0.85 * strength, time, 0.006, 2.2)], out, time, time + 2.4);
    shot(noise(context), [filter(context, "lowpass", 240, time), envelope(context, 0.5 * strength, time, 0.003, 0.5)], out, time, time + 0.7);
    shot(noise(context), [filter(context, "highpass", 4200, time), envelope(context, 0.12 * strength, time, 0.01, 2.6)], out, time, time + 2.8);
  }

  function pluck(context: AudioContext, out: AudioNode, hz: number, time: number, level: number, pan: number, brightness: number) {
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(hz, time);
    const tone = filter(context, "lowpass", brightness, time, 2);
    tone.frequency.exponentialRampToValueAtTime(Math.max(600, hz * 2), time + 0.35);
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);
    // A ringing decay, so notes overlap into a flowing ostinato instead of ticks.
    const amp = context.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(level, time + 0.004);
    amp.gain.setTargetAtTime(0.0001, time + 0.004, PLUCK_RING);
    shot(oscillator, [tone, amp, panner], out, time, time + PLUCK_RING * 6);
  }

  function drum(context: AudioContext, out: AudioNode, time: number, from: number, to: number, level: number, decay: number) {
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + 0.14);
    shot(oscillator, [envelope(context, level, time, 0.003, decay)], out, time, time + decay + 0.1);
  }

  function hat(context: AudioContext, out: AudioNode, time: number, level: number) {
    shot(noise(context), [filter(context, "highpass", 7000, time), envelope(context, level, time, 0.001, 0.05)], out, time, time + 0.08);
  }

  function clap(context: AudioContext, out: AudioNode, time: number, level: number) {
    shot(noise(context), [filter(context, "bandpass", 1800, time, 0.9), envelope(context, level, time, 0.002, 0.16)], out, time, time + 0.2);
  }

  /** A brassy horn: two detuned saws whose filter opens as the note swells. */
  function horn(context: AudioContext, out: AudioNode, hz: number, time: number, length: number, level: number, brightness: number) {
    const tone = filter(context, "lowpass", 500, time, 1.2);
    tone.frequency.linearRampToValueAtTime(brightness, time + 0.15);
    const amp = context.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(level, time + 0.12);
    amp.gain.setTargetAtTime(level * 0.8, time + 0.12, 0.3);
    amp.gain.setTargetAtTime(0.0001, time + length, 0.12);
    const second = context.createOscillator();
    second.type = "sawtooth";
    second.frequency.setValueAtTime(hz, time);
    second.detune.setValueAtTime(6, time);
    second.connect(tone);
    second.onended = () => { second.disconnect(); };
    second.start(time);
    second.stop(time + length + 0.6);
    const first = context.createOscillator();
    first.type = "sawtooth";
    first.frequency.setValueAtTime(hz, time);
    first.detune.setValueAtTime(-6, time);
    shot(first, [tone, amp], out, time, time + length + 0.6);
  }

  function bell(context: AudioContext, out: AudioNode, hz: number, time: number, level: number) {
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(hz, time);
    shot(oscillator, [envelope(context, level, time, 0.005, 1.6)], out, time, time + 1.7);
  }

  /** Everything that lands on one sixteenth, from the chord and energy of that moment. */
  function play(context: AudioContext, s: Session, time: number) {
    if (pending > 0) {
      const strength = pending;
      pending = 0;
      s.step = 0;
      lastImpact = time;
      lastStrength = strength;
      latched = true;
      impact(context, s.out, time, strength);
      swap(context, s, time, ARRIVAL, DEPARTURE);
      shape(time);
    }
    const { chord } = s.layer;
    const { intensity } = chord;
    // Building toward the next scene pushes the groove before the chord arrives.
    const energy = Math.min(1, intensity + (latched ? 0 : rise) * 0.3);
    const beat = s.step % BAR;
    const phrase = s.step % PHRASE;
    const [root, third, fifth] = chord.notes;
    const arp = [root, third, fifth, root + 12, third + 12, fifth + 12].map(note => midi(note + 12));
    const every = energy >= 0.55 ? 1 : energy >= 0.35 ? 2 : 4;
    if (beat % every === 0) {
      const level = (beat % 4 === 0 ? 0.24 : 0.17) * (0.5 + 0.5 * energy);
      const pan = beat % 2 === 0 ? -0.35 : 0.35;
      pluck(context, s.out, arp[ARP[beat]], time, level, pan, 1400 + energy * 3600);
      // A high ostinato an octave up makes the groove shimmer as it grows.
      if (energy >= 0.6) pluck(context, s.out, arp[ARP[beat]] * 2, time, level * 0.4, -pan, 3400 + energy * 3600);
    }
    const kick = intensity >= 0.75 ? beat % 4 === 0 : intensity >= 0.55 ? beat % 8 === 0 : intensity >= 0.4 && beat === 0;
    if (kick) drum(context, s.out, time, 150, 42, 0.34, 0.45);
    // The climax drives on with a backbeat.
    if (intensity >= 1 && beat % 8 === 4) clap(context, s.out, time, 0.2);
    if (intensity >= 0.86 && FILL.includes(phrase)) drum(context, s.out, time, 120, 70, 0.35, 0.4);
    if (intensity >= 0.55 && beat % 2 === 0) pluck(context, s.out, midi(chord.bass + 12), time, 0.045, 0, 500);
    if (energy >= 0.6 && (energy >= 0.95 ? beat % 2 === 1 : beat % 4 === 2)) hat(context, s.out, time, 0.09);
    if (intensity >= 0.75) {
      const tones = [...chord.notes].sort((a, b) => a - b).slice(0, 4).map(note => note + 12);
      for (const [at, length, tone] of THEME) {
        if (at !== phrase) continue;
        const brightness = 1200 + intensity * 1400;
        const level = intensity >= 1 ? 0.09 : 0.07;
        horn(context, s.out, midi(tones[tone]), time, length * STEP_SECONDS, level, brightness);
        if (intensity >= 1) horn(context, s.out, midi(tones[tone] + 12), time, length * STEP_SECONDS, level * 0.65, brightness);
      }
    }
    if (bloom > 0.15 && beat % (bloom > 0.5 ? 2 : 4) === 0) bell(context, s.out, arp[ARP[(beat + 5) % BAR]] * 2, time, 0.02 + bloom * 0.05);
  }

  function tick() {
    const context = core.context();
    if (!session || !context) return;
    // After a stalled timer, skip what was missed instead of bursting it out.
    if (session.next < context.currentTime - 0.25) session.next = context.currentTime + 0.02;
    while (session.next < context.currentTime + LOOKAHEAD) {
      play(context, session, session.next);
      session.next += STEP_SECONDS;
      session.step++;
    }
  }

  /** Queues an impact on the next sixteenth; the chord changes with it. */
  function request(context: AudioContext, strength: number) {
    // The reveal's climax is never swallowed by the scene impact just before it.
    if (pending === 0 && context.currentTime - lastImpact < IMPACT_GAP && strength <= lastStrength) return;
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
    const now = context.currentTime;
    const master = context.createGain();
    master.connect(output);
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
    session = { master, out, pad, sweep, riser, layer: layer(context, { pad }, target(), now, FADE_IN), retired: new Set(), timer: 0, next: now + 0.05, step: 0 };
    shape(now);
    session.timer = window.setInterval(tick, TICK_MS);
    tick();
  }

  function end(seconds: number) {
    pending = 0;
    const context = core.context();
    if (!session || !context) { session = null; return; }
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
  }

  core.subscribe(() => {
    if (wanted && core.audible()) begin();
    else if (!core.audible()) end(0.15);
  });

  return {
    /** The story is on screen: play once audio is allowed. */
    start() { wanted = true; if (core.audible()) begin(); },
    /** The story left the screen: fade out. */
    stop() { wanted = false; end(FADE_OUT); },
    /** A new scene lands an impact: full going forward, softer going back. */
    setScene(index: number) {
      const next = Math.max(0, Math.min(SCENE_CHORDS.length - 1, Math.trunc(index)));
      if (next === scene) return;
      const forward = next > scene;
      scene = next;
      const context = core.context();
      if (session && context) request(context, forward ? 1 : 0.45);
      refresh();
    },
    setBloom(value: number) {
      const next = clamp(value);
      if (Math.abs(next - bloom) < 0.005) return;
      const revealed = target().key === "reveal";
      bloom = next;
      const context = core.context();
      // The reveal is the climax: the strongest impact of the story.
      if (!revealed && target().key === "reveal" && session && context) request(context, 1.3);
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
  };
}

export type StoryMusic = ReturnType<typeof createStoryMusic>;

/** The story's single soundtrack. */
export const storyMusic = createStoryMusic();
