import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  // Fail closed so an accidental provider call cannot consume API quota.
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Network is disabled in tests"))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
