import { createDownsampler } from "./wav";

export type MicCapture = { stop: () => void };

/** Why the microphone could not start: no permission, no device, or no browser support. */
export class MicUnavailableError extends Error {
  readonly reason: "denied" | "noMic" | "unsupported";

  constructor(reason: MicUnavailableError["reason"]) {
    super(`Microphone unavailable: ${reason}`);
    this.name = "MicUnavailableError";
    this.reason = reason;
  }
}

// The worklet copies the input in 2048-sample chunks; the main thread downsamples them.
const WORKLET_SOURCE = `
class JevPcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Float32Array(2048); this.length = 0; }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const count = Math.min(channel.length - offset, this.buffer.length - this.length);
      this.buffer.set(channel.subarray(offset, offset + count), this.length);
      this.length += count;
      offset += count;
      if (this.length === this.buffer.length) {
        this.port.postMessage(this.buffer, [this.buffer.buffer]);
        this.buffer = new Float32Array(2048);
        this.length = 0;
      }
    }
    return true;
  }
}
registerProcessor("jev-pcm-capture", JevPcmCapture);
`;

export function micSupported() {
  return typeof window !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof AudioContext === "function" &&
    typeof AudioWorkletNode === "function";
}

function reasonFor(error: unknown): MicUnavailableError["reason"] {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "noMic";
  return "unsupported";
}

/**
 * Opens the microphone with echo cancellation and streams 16 kHz mono samples to `onAudio`.
 * Call it from the user's gesture: the audio context is created before the permission prompt.
 */
export async function startMicCapture(onAudio: (samples: Float32Array) => void): Promise<MicCapture> {
  if (!micSupported()) throw new MicUnavailableError("unsupported");
  // Its own context: muting Jev's sound suspends the shared one, never the microphone.
  const context = new AudioContext();
  let stream: MediaStream | null = null;
  const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
  const release = () => {
    stream?.getTracks().forEach(track => track.stop());
    void context.close().catch(() => undefined);
    URL.revokeObjectURL(moduleUrl);
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    await context.audioWorklet.addModule(moduleUrl);
    if (context.state === "suspended") await context.resume();
  } catch (error) {
    release();
    throw error instanceof MicUnavailableError ? error : new MicUnavailableError(reasonFor(error));
  }

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "jev-pcm-capture");
  const downsample = createDownsampler(context.sampleRate);
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const samples = downsample(event.data);
    if (samples.length > 0) onAudio(samples);
  };
  source.connect(node);
  // The processor writes silence; the connection only keeps it running in every engine.
  node.connect(context.destination);

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      release();
    },
  };
}
