import { describe, expect, it } from "vitest";

import { LISTEN_SAMPLE_RATE, LISTEN_SEGMENT_MAX_MS, WAV_HEADER_BYTES } from "../src/creature/listen/listenProtocol";
import { createVoiceActivityDetector } from "../src/creature/listen/voiceActivity";
import { bytesToBase64, createDownsampler, encodeWav } from "../src/creature/listen/wav";

const samplesFor = (ms: number) => Math.round((LISTEN_SAMPLE_RATE * ms) / 1000);
const silence = (ms: number) => new Float32Array(samplesFor(ms));
const tone = (ms: number, amplitude = 0.3) =>
  Float32Array.from({ length: samplesFor(ms) }, (_, index) => amplitude * Math.sin((2 * Math.PI * 220 * index) / LISTEN_SAMPLE_RATE));
// Deterministic hiss: the same room noise on every run.
const hiss = (ms: number, amplitude: number) => {
  let seed = 7;
  return Float32Array.from({ length: samplesFor(ms) }, () => {
    seed = (seed * 16807) % 2147483647;
    return amplitude * ((seed / 2147483647) * 2 - 1);
  });
};
const join = (...parts: Float32Array[]) => {
  const all = new Float32Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  return all;
};
// The microphone delivers ~43 ms chunks; feeding them one by one matches the real stream.
const feed = (detector: ReturnType<typeof createVoiceActivityDetector>, audio: Float32Array, chunk = 683) => {
  const segments = [];
  for (let offset = 0; offset < audio.length; offset += chunk) segments.push(...detector.push(audio.subarray(offset, offset + chunk)));
  return segments;
};

describe("downsampler", () => {
  it("turns 48 kHz into 16 kHz, the same in chunks as at once", () => {
    const input = Float32Array.from({ length: 4800 }, (_, index) => Math.sin(index / 50));
    const whole = createDownsampler(48_000)(input);
    const chunked = createDownsampler(48_000);
    const parts = [input.subarray(0, 1000), input.subarray(1000, 1001), input.subarray(1001)].map(part => chunked(part));
    expect(whole).toHaveLength(1600);
    expect(Array.from(join(...parts))).toEqual(Array.from(whole));
  });

  it("keeps a steady level and handles a rate that is not a multiple", () => {
    const output = createDownsampler(44_100)(new Float32Array(44_100).fill(0.5));
    expect(output.length).toBeGreaterThanOrEqual(15_999);
    expect(output.length).toBeLessThanOrEqual(16_000);
    expect(output.every(sample => Math.abs(sample - 0.5) < 1e-6)).toBe(true);
  });

  it("refuses to upsample", () => {
    expect(() => createDownsampler(8_000)).toThrow(RangeError);
  });
});

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM header and clamps the samples", () => {
    const bytes = encodeWav(Float32Array.from([0, 1, -1, 2]));
    const view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.subarray(8, 16))).toBe("WAVEfmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(LISTEN_SAMPLE_RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(bytes).toHaveLength(WAV_HEADER_BYTES + 8);
    expect([0, 1, 2, 3].map(index => view.getInt16(WAV_HEADER_BYTES + index * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });

  it("encodes to base64 the same way Node does", () => {
    const bytes = encodeWav(tone(500));
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});

describe("voice activity detector", () => {
  it("closes a phrase after its silence, with the pre-roll and a short tail", () => {
    const detector = createVoiceActivityDetector();
    const segments = feed(detector, join(silence(1000), tone(1000), silence(1000)));
    expect(segments).toHaveLength(1);
    expect(segments[0].speechMs).toBeGreaterThanOrEqual(960);
    // 300 ms of pre-roll (its last 60 ms already voiced), the rest of the phrase and 200 ms after it.
    expect(segments[0].samples.length / LISTEN_SAMPLE_RATE).toBeCloseTo(1.44, 2);
    expect(detector.speaking).toBe(false);
  });

  it("reports the open phrase while it is heard", () => {
    const detector = createVoiceActivityDetector();
    feed(detector, join(silence(500), tone(300)));
    expect(detector.speaking).toBe(true);
    feed(detector, silence(800));
    expect(detector.speaking).toBe(false);
  });

  it("ignores a click shorter than a phrase", () => {
    const detector = createVoiceActivityDetector();
    expect(feed(detector, join(silence(500), tone(100), silence(1000)))).toEqual([]);
  });

  it("cuts a phrase at the maximum length", () => {
    const detector = createVoiceActivityDetector();
    const [first] = feed(detector, join(silence(300), tone(LISTEN_SEGMENT_MAX_MS + 2000)));
    expect(first.samples.length).toBe(samplesFor(LISTEN_SEGMENT_MAX_MS));
  });

  it("sends a hum that never pauses once, and hears a voice again at the next pause", () => {
    const detector = createVoiceActivityDetector();
    expect(feed(detector, join(silence(500), tone(LISTEN_SEGMENT_MAX_MS * 4, 0.05)))).toHaveLength(1);
    expect(detector.speaking).toBe(false);
    expect(feed(detector, join(silence(200), tone(1000, 0.4), silence(1000)))).toHaveLength(1);
  });

  it("does not take a sudden hiss for a phrase", () => {
    const detector = createVoiceActivityDetector();
    expect(feed(detector, join(silence(500), hiss(1500, 0.2), silence(1000)))).toEqual([]);
    expect(detector.speaking).toBe(false);
  });

  it("does not take typing or claps for a phrase", () => {
    const detector = createVoiceActivityDetector();
    const taps = Array.from({ length: 12 }, () => join(hiss(50, 0.4), silence(90)));
    expect(feed(detector, join(silence(500), ...taps, silence(1000)))).toEqual([]);
  });

  it("hears a voice saying a single short word", () => {
    const detector = createVoiceActivityDetector();
    expect(feed(detector, join(silence(500), tone(250), silence(1000)))).toHaveLength(1);
  });

  it("learns steady room noise and still hears a voice over it", () => {
    const detector = createVoiceActivityDetector();
    expect(feed(detector, hiss(3000, 0.05))).toEqual([]);
    expect(detector.speaking).toBe(false);
    const audio = hiss(2500, 0.05);
    audio.set(tone(1000, 0.4).map((sample, index) => sample + audio[index]), samplesFor(500));
    expect(feed(detector, audio)).toHaveLength(1);
  });
});
