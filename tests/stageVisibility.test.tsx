// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useStageVisibility } from "../src/features/presentation/useStageVisibility";

// The observer can batch several changes for one target: the stale starting
// position comes first and the current one last. The latest entry is the state.
let report: IntersectionObserverCallback | undefined;
const entry = (isIntersecting: boolean) => ({ isIntersecting } as IntersectionObserverEntry);

function Stage() {
  const stage = useRef<HTMLDivElement>(null);
  const visible = useStageVisibility(stage);
  return <div ref={stage} data-testid="stage" data-visible={String(visible)} />;
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { report = callback; }
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); report = undefined; });

const deliver = (entries: boolean[]) => act(() => report?.(entries.map(entry), {} as IntersectionObserver));
const visible = () => screen.getByTestId("stage").dataset.visible;

describe("stage visibility", () => {
  it("follows single transitions into and out of the viewport", () => {
    render(<Stage />);
    deliver([false]);
    expect(visible()).toBe("false");
    deliver([true]);
    expect(visible()).toBe("true");
  });

  it("ends on the latest state when a batch starts with a stale position", () => {
    render(<Stage />);
    deliver([false]);
    deliver([false, true]);
    expect(visible()).toBe("true");
  });

  it("ends out of view when a batch finishes outside the viewport", () => {
    render(<Stage />);
    deliver([true, false]);
    expect(visible()).toBe("false");
  });
});
