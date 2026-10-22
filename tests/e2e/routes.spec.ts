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

// A stalled CDN download of rive.wasm used to leave Jev on «Preparando a Jev…»: it must come from this site.
test("loads Jev's Rive runtime from this site, never from a CDN", async ({ page, baseURL }) => {
  const wasm: string[] = [];
  page.on("request", request => { if (request.url().includes(".wasm")) wasm.push(request.url()); });
  await page.goto("/features");
  await expect(page.locator(READY["/features"])).toBeAttached({ timeout: 45_000 });
  expect(wasm.length).toBeGreaterThan(0);
  for (const url of wasm) expect(url.startsWith(`${baseURL}/`)).toBe(true);
});

test("renders the not-found view for an unknown path", async ({ page }) => {
  await page.goto("/no-existe");
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});
