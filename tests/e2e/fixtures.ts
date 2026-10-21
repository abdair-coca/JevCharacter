import { test as base, expect, type Page } from "@playwright/test";

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
