import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";

type Report = { drawMs: number; count: number };

// The vortex reports itself: every 60 frames it publishes its mean draw time and, while the scene
// moves and that mean is over budget, thins out by 18% down to its floor. Each report is kept.
async function scrollTheStory(page: Page, info: TestInfo) {
  await page.goto("/about");
  const particles = page.locator(".story-particles[data-prepared='true']");
  await expect(particles).toBeAttached({ timeout: 45_000 });
  await particles.evaluate(element => {
    const target = window as unknown as { __reports: Report[] };
    target.__reports = [];
    new MutationObserver(() => {
      const canvas = element as HTMLCanvasElement;
      target.__reports.push({ drawMs: Number(canvas.dataset.drawMs), count: Number(canvas.dataset.count) });
    }).observe(element, { attributeFilter: ["data-draw-ms"] });
  });
  const tokens = await page.locator(".story-page").evaluate(element => {
    const css = getComputedStyle(element);
    const token = (name: string) => Number(css.getPropertyValue(`--particle-${name}`));
    return { budget: token("budget-ms"), floor: token("min-count"), count: token("count"), mobile: token("mobile-count") };
  });
  const start = Number(await particles.getAttribute("data-count"));
  expect([tokens.count, tokens.mobile]).toContain(start);

  // Through every scene to the outro, at the pace of a steady wheel.
  const distance = page.viewportSize()!.height * 6;
  for (let travelled = 0; travelled < distance; travelled += 100) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(60);
  }
  const read = () => page.evaluate(() => (window as unknown as { __reports: Report[] }).__reports);
  await expect.poll(async () => (await read()).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  const reports = await read();
  const summary = `start ${start} → ${reports.at(-1)!.count}; draw ms ${reports.map(report => report.drawMs).join(", ")}`;
  info.annotations.push({ type: "particles", description: summary });
  console.log(`[particles] ${info.project.name} ${info.title}: ${summary}`);

  for (const report of reports) {
    expect(report.count).toBeGreaterThanOrEqual(tokens.floor);
    expect(report.count).toBeLessThanOrEqual(start);
  }
  // A report over budget with room to thin out already carries fewer particles (same frame).
  reports.reduce((previous, report) => {
    if (report.drawMs > tokens.budget && previous > tokens.floor) expect(report.count).toBeLessThan(previous);
    return report.count;
  }, start);
  // Thinning out must be enough: at the floor the vortex may run late, never below ~25 fps.
  expect(reports.at(-1)!.drawMs).toBeLessThanOrEqual(tokens.budget * 4);
  return { start, reports };
}

test.describe("story particles", () => {
  // Mobile WebKit has no wheel to scroll with, and its Linux canvas does not stand for Safari's speed.
  test.skip(({ browserName }) => browserName === "webkit", "measured on Chromium engines");

  test("keep their frame budget while scrolling", async ({ page }, info) => {
    await scrollTheStory(page, info);
  });

  test("thin out on a slow CPU instead of dropping frames", async ({ page }, info) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    const { start, reports } = await scrollTheStory(page, info);
    expect(reports.at(-1)!.count).toBeLessThan(start);
  });
});
