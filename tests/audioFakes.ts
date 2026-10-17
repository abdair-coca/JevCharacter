import { vi } from "vitest";
import { createAudioCore } from "../src/lib/audioCore";

/** Records every automation call so tests can read the scheduled values. */
export class FakeParam {
  value = 0;
  events: { method: string; value: number; time: number; constant?: number }[] = [];
  private record(method: string, value: number, time: number, constant?: number) { this.events.push({ method, value, time, constant }); this.value = value; return this; }
  setValueAtTime(value: number, time: number) { return this.record("set", value, time); }
  linearRampToValueAtTime(value: number, time: number) { return this.record("linear", value, time); }
  exponentialRampToValueAtTime(value: number, time: number) { return this.record("exponential", value, time); }
  setTargetAtTime(value: number, time: number, constant: number) { return this.record("target", value, time, constant); }
  cancelScheduledValues() { return this; }
}
/** Remembers where it connects, so tests can follow the signal path. */
export class FakeNode {
  disconnected = false;
  outputs: FakeNode[] = [];
  connect<T>(target: T) { this.outputs.push(target as FakeNode); return target; }
  disconnect() { this.disconnected = true; }
}
export type FakeGain = FakeNode & { gain: FakeParam };
export class FakeSource extends FakeNode {
  startAt = -1;
  stops: (number | undefined)[] = [];
  onended: (() => void) | null = null;
  start(time = 0) { this.startAt = time; }
  stop(time?: number) { this.stops.push(time); }
  addEventListener() {}
}
export class FakeOscillator extends FakeSource {
  type = "sine";
  frequency = new FakeParam();
  detune = new FakeParam();
}
export class FakeNoise extends FakeSource {
  buffer: unknown = null;
  loop = false;
}
export class FakeContext {
  currentTime = 0;
  sampleRate = 100;
  state: "running" | "suspended" | "closed" = "running";
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  noises: FakeNoise[] = [];
  convolvers: FakeNode[] = [];
  resume = vi.fn(async () => { this.state = "running"; });
  suspend = vi.fn(async () => { this.state = "suspended"; });
  createOscillator() { const oscillator = new FakeOscillator(); this.oscillators.push(oscillator); return oscillator; }
  createBufferSource() { const noise = new FakeNoise(); this.noises.push(noise); return noise; }
  createGain(): FakeGain { return Object.assign(new FakeNode(), { gain: new FakeParam() }); }
  createStereoPanner() { return Object.assign(new FakeNode(), { pan: new FakeParam() }); }
  createBiquadFilter() { return Object.assign(new FakeNode(), { type: "lowpass", frequency: new FakeParam(), Q: new FakeParam() }); }
  createConvolver() { const convolver = Object.assign(new FakeNode(), { buffer: null as unknown }); this.convolvers.push(convolver); return convolver; }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createDynamicsCompressor() { return new FakeNode(); }
}

/** A real audio core over a fake context; `null` simulates a browser without Web Audio. */
export function fakeCore(context: FakeContext | null) {
  return createAudioCore({ createContext: () => context as unknown as AudioContext });
}
/** Whether a signal leaving `node` can reach `target`; a modulated param ends the path. */
export const reaches = (node: FakeNode, target: FakeNode): boolean => node === target || (node.outputs ?? []).some(next => reaches(next, target));
/** Sources that were cut short: stopped immediately and disconnected. */
export const silenced = (source: FakeSource) => source.stops.includes(undefined) && source.disconnected;
/** Sources whose stop is scheduled (a fade-out), not cut immediately. */
export const scheduledToStop = (source: FakeSource) => source.stops.some(time => typeof time === "number");
