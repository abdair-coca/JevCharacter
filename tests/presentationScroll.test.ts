// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquirePresentationScroll, enablePresentationEngine, releaseIdlePresentationEngine, setPresentationVisibility } from "../src/features/presentation/scrollRuntime";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  lenis: { options: { smoothWheel: true }, on: vi.fn(), off: vi.fn(), start: vi.fn(), stop: vi.fn(), raf: vi.fn(), scrollTo: vi.fn(), destroy: vi.fn() },
  ticker: { add: vi.fn(), remove: vi.fn(), sleep: vi.fn() },
  triggers: { getAll: vi.fn(() => [] as unknown[]), disable: vi.fn(), enable: vi.fn(), update: vi.fn() },
}));
vi.mock("lenis", () => ({ default: class { constructor(options: unknown) { mocks.create(options); return mocks.lenis; } } }));
vi.mock("gsap", () => ({ gsap: { ticker: mocks.ticker, globalTimeline: { getChildren: () => [] } } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: mocks.triggers }));
const leases: ReturnType<typeof acquirePresentationScroll>[] = [];
const acquire = () => { const lease = acquirePresentationScroll(0.12); leases.push(lease); return lease; };
beforeEach(() => { mocks.triggers.getAll.mockReturnValue([]); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); enablePresentationEngine(); vi.clearAllMocks(); });
afterEach(() => { leases.splice(0).forEach(lease => lease.release()); });

describe("shared presentation scroll", () => {
  it("uses one Lenis/ticker across owners and destroys only after the last release", () => {
    const first = acquire(); const second = acquire();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ autoRaf: false }));
    expect(mocks.ticker.add).toHaveBeenCalledOnce();
    first.release(); first.release();
    expect(mocks.lenis.destroy).not.toHaveBeenCalled();
    second.scrollTo(100);
    expect(mocks.lenis.scrollTo).toHaveBeenCalledWith(100, { immediate: true, force: true });
    second.release();
    expect(mocks.lenis.destroy).toHaveBeenCalledOnce();
    expect(mocks.ticker.remove).toHaveBeenCalled();
  });
  it("pauses only when all clients suspend and restarts without an additional driver", () => {
    const first = acquire(); const second = acquire();
    first.setActive(false);
    expect(mocks.lenis.stop).not.toHaveBeenCalled();
    second.setActive(false);
    expect(mocks.lenis.stop).toHaveBeenCalledOnce();
    expect(mocks.lenis.options.smoothWheel).toBe(false);
    expect(mocks.ticker.remove).toHaveBeenCalledOnce();
    first.setActive(true);
    expect(mocks.lenis.options.smoothWheel).toBe(true);
    expect(mocks.ticker.add).toHaveBeenCalledTimes(2);
  });
  it("does not disable another presentation's triggers or a live scroll owner", () => {
    const lease = acquire();
    releaseIdlePresentationEngine();
    expect(mocks.triggers.disable).not.toHaveBeenCalled();
    lease.release();
    mocks.triggers.getAll.mockReturnValue([{}]);
    releaseIdlePresentationEngine();
    expect(mocks.triggers.disable).not.toHaveBeenCalled();
    mocks.triggers.getAll.mockReturnValue([]);
    releaseIdlePresentationEngine();
    expect(mocks.triggers.disable).toHaveBeenCalledOnce();
  });
  it("suspends the document engine without unpinning and reenables it only once", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    setPresentationVisibility(false); setPresentationVisibility(false);
    expect(mocks.triggers.disable).toHaveBeenCalledExactlyOnceWith(false);
    setPresentationVisibility(true); setPresentationVisibility(true);
    expect(mocks.triggers.enable).toHaveBeenCalledOnce();
  });
});
