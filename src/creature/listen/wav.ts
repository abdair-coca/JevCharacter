import { LISTEN_SAMPLE_RATE, WAV_HEADER_BYTES } from "./listenProtocol";

/**
 * Returns a streaming downsampler: each call takes the next chunk at `fromRate` and returns the
 * samples it completes at `toRate`. Every output sample averages the input it covers, which
 * filters out what the lower rate cannot hold.
 */
export function createDownsampler(fromRate: number, toRate = LISTEN_SAMPLE_RATE) {
  const ratio = fromRate / toRate;
  if (!(ratio >= 1)) throw new RangeError("Only downsampling is supported");
  let pending = new Float32Array(0);
  // Where the next output window starts inside `pending`, in input samples.
  let offset = 0;

  return (chunk: Float32Array): Float32Array => {
    const input = new Float32Array(pending.length + chunk.length);
    input.set(pending);
    input.set(chunk, pending.length);
    const count = Math.max(0, Math.floor((input.length - offset) / ratio));
    const output = new Float32Array(count);
    for (let index = 0; index < count; index++) {
      const start = offset + index * ratio;
      const end = Math.min(input.length, Math.ceil(start + ratio));
      let sum = 0;
      for (let sample = Math.floor(start); sample < end; sample++) sum += input[sample];
      output[index] = sum / Math.max(1, end - Math.floor(start));
    }
    const consumed = offset + count * ratio;
    const whole = Math.floor(consumed);
    pending = input.slice(whole);
    offset = consumed - whole;
    return output;
  };
}

/** 16-bit PCM mono WAV, the format `/api/transcribe` accepts. */
export function encodeWav(samples: Float32Array, sampleRate = LISTEN_SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(WAV_HEADER_BYTES + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
  };
  ascii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(WAV_HEADER_BYTES + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  // Chunks keep String.fromCharCode under the engine's argument limit.
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
