import { expect, test } from "./fixtures";

const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

for (const device of ["desktop", "mobile"] as const) {
  test(`Abdair's section gathers his portrait and reads through to the contact on ${device}`, async ({ page }) => {
    await page.setViewportSize(viewports[device]);
    await page.goto("/abdair");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hola, soy Abdair.");
    const portrait = page.locator(".author-particles");
    await expect(portrait).toHaveAttribute("data-gathered", "true", { timeout: 20_000 });
    await expect(portrait).toHaveAttribute("data-running", "true");
    // The portrait sits inside the first screen.
    const box = (await page.locator(".author-portrait").boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewports[device].height);

    // Scrolling the hero away dissolves the portrait; the statement then lights its last word.
    await page.locator(".author-statement").scrollIntoViewIfNeeded();
    await expect.poll(async () => Number(await portrait.getAttribute("data-exit"))).toBe(1);
    const statement = page.locator(".author-statement");
    await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>(".author-statement")!;
      window.scrollTo({ top: section.offsetTop + section.offsetHeight - innerHeight, behavior: "instant" });
    });
    await expect.poll(() => statement.locator(".author-word").last().evaluate(word => Number(getComputedStyle(word).opacity))).toBeGreaterThan(0.95);

    const links = page.getByRole("list", { name: "Me encuentras en" }).getByRole("link");
    await expect(links).toHaveCount(4);
    await links.last().scrollIntoViewIfNeeded();
    await expect(links.last()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}

test("the header still fits in one row at 320px with the four views", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/abdair");
  await expect(page.getByRole("link", { name: "Abdair" })).toHaveAttribute("aria-current", "page");
  const gear = (await page.getByRole("button", { name: "Ajustes", exact: true }).boundingBox())!;
  expect(gear.x + gear.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("shows the photo instead of particles and every word already lit", async ({ page }) => {
    await page.goto("/abdair");
    await expect(page.locator(".author-portrait__photo")).toBeVisible();
    await expect(page.locator(".author-particles")).toHaveCount(0);
    await expect(page.locator(".author-word").first()).toHaveCSS("opacity", "1");
  });
});
