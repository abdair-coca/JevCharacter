import { test as base, expect, type Locator, type Page } from "@playwright/test";

type Box = { x: number; y: number; width: number; height: number };

// The API always answers 503, so specs never reach a provider and the app runs on its local instinct.
export const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: '{"unavailable":true}' }),
    );
    await use(page);
    expect(pageErrors, "uncaught page errors").toEqual([]);
  },
});

export { expect };

/**
 * Waits until an element stops moving (two reads 100 ms apart agree to the pixel) and returns its box.
 * Use it instead of fixed sleeps before measuring anything that slides or springs into place.
 */
export async function restingBox(locator: Locator): Promise<Box> {
  const last: { key: string; box: Box | null } = { key: "", box: null };
  await expect.poll(async () => {
    const box = await locator.boundingBox();
    const key = box ? [box.x, box.y, box.width, box.height].map(Math.round).join() : "";
    const resting = key !== "" && key === last.key;
    last.key = key;
    last.box = box;
    return resting;
  }, { intervals: [100] }).toBe(true);
  if (!last.box) throw new Error("element has no box");
  return last.box;
}

/**
 * Waits until Home's Jev has loaded (Rive ready) and come to rest, and returns where it rests.
 * Tests that measure Jev's position or count its painted frames must start here: before Rive is
 * ready there is no canvas to measure, which looks like a broken shape instead of a slow load.
 */
export async function jevAtRest(page: Page): Promise<Box> {
  await expect(page.locator(".home-page .character-rive[data-ready='true']")).toBeAttached({ timeout: 45_000 });
  return restingBox(page.locator(".creature-presence"));
}

/** Runs an action and returns Jev's canvas width/height ratio on every frame of the next second. */
export async function characterAspectsDuring(page: Page, action: () => Promise<void>) {
  await page.evaluate(() => {
    const target = window as unknown as { __aspects: number[] };
    target.__aspects = [];
    const end = performance.now() + 1_500;
    const tick = () => {
      const box = document.querySelector(".creature-presence canvas")?.getBoundingClientRect();
      if (box && box.height > 0) target.__aspects.push(box.width / box.height);
      if (performance.now() < end) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await action();
  await page.waitForTimeout(1_600);
  return page.evaluate(() => (window as unknown as { __aspects: number[] }).__aspects);
}
