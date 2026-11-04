/** Limits shared by the browser capture and `/api/transcribe`. A leaf module: the API imports it too. */
export const LISTEN_SAMPLE_RATE = 16_000;
/** A heard phrase never runs longer than this, pre-roll and trailing silence included. */
export const LISTEN_SEGMENT_MAX_MS = 15_000;
/** Shorter voiced audio is a click, not a phrase. Saying only «Jev» lasts 200–320 ms and «No» from 180 ms (measured 2026-11-03). */
export const LISTEN_SPEECH_MIN_MS = 150;
export const WAV_HEADER_BYTES = 44;
/** 16-bit mono WAV at {@link LISTEN_SAMPLE_RATE} for the longest phrase. */
export const LISTEN_AUDIO_MAX_BYTES = WAV_HEADER_BYTES + (LISTEN_SAMPLE_RATE * 2 * LISTEN_SEGMENT_MAX_MS) / 1000;
export const TRANSCRIPT_MAX_CHARS = 400;
