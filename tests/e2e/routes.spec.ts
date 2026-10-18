import { expect, test } from "./fixtures";

const READY = {
  "/": ".home-page .character-rive[data-ready='true']",
  "/features": ".features-page .character-rive[data-ready='true']",
  "/about": ".story-particles[data-prepared='true']",
} as const;

for (const path of Object.keys(READY) as (keyof typeof READY)[]) {
  test(`loads ${path} directly and renders its view`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator(READY[path])).toBeAttached({ timeout: 45_000 });
    await expect(page.locator("h1").first()).toBeAttached();
  });
}

test("renders the not-found view for an unknown path", async ({ page }) => {
  await page.goto("/no-existe");
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});
