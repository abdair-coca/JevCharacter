import type { Page } from "@playwright/test";
import { characterAspectsDuring, expect, test } from "./fixtures";

const INPUT = "#creature-context";
const EVIDENCE = process.env.REPLY_EVIDENCE;

const talkDecision = {
  action: { kind: "talk", state: "talkb" },
  actionConfidence: 0.9, reaction: "BASE", reactionConfidence: 0.9,
  probabilities: { BASE: 0.8, HELLO: 0.1, GHOST: 0.05, FLOWER: 0.05, QUESTION: 0 },
  intensity: 0.4, wantsAttention: 0.3, source: "jev",
};

const longBlocks = [
  { type: "paragraph", text: "La fotosíntesis ocurre en los cloroplastos. La clorofila captura la luz y con esa energía la planta separa el agua y fija el dióxido de carbono en azúcares." },
  { type: "steps", items: ["La luz excita la clorofila.", "El agua se separa y libera oxígeno.", "Se forman ATP y NADPH.", "El ciclo de Calvin fija el CO₂ en glucosa."] },
  { type: "compare", columns: [{ title: "Fase luminosa", points: ["Necesita luz", "Produce ATP"] }, { title: "Ciclo de Calvin", points: ["No necesita luz", "Produce glucosa"] }] },
  { type: "highlight", value: "6 CO₂", label: "Moléculas fijadas por cada glucosa" },
  { type: "callout", tone: "tip", text: "Por eso las plantas liberan oxígeno durante el día." },
  { type: "chips", items: ["¿Qué es el ciclo de Calvin?", "¿Y de noche?"] },
];

function sse(spoken: string, blocks: unknown[]) {
  return [
    `event: spoken\ndata: ${JSON.stringify({ text: spoken })}\n\n`,
    ...blocks.map(block => `event: block\ndata: ${JSON.stringify({ block })}\n\n`),
    "event: done\ndata: {}\n\n",
  ].join("");
}

/** Every message makes Jev talk; each talk request answers with the next queued reply. */
async function mockTalk(page: Page, replies: { spoken: string; blocks: unknown[] }[]) {
  await page.route("**/api/decide", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(talkDecision) }));
  let index = 0;
  await page.route("**/api/talk", route => {
    const reply = replies[Math.min(index++, replies.length - 1)];
    return route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(reply.spoken, reply.blocks) });
  });
}

async function send(page: Page, text: string) {
  await page.locator(INPUT).fill(text);
  await page.locator(INPUT).press("Enter");
}

async function stageIsSingleScreen(page: Page) {
  const overflow = await page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - window.innerHeight,
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(overflow.vertical).toBeLessThanOrEqual(1);
  expect(overflow.horizontal).toBeLessThanOrEqual(1);
}

async function capture(page: Page, name: string) {
  if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/${name}.png` });
}

async function open(page: Page, theme: "light" | "dark" = "light") {
  await page.addInitScript(value => window.localStorage.setItem("jevling.theme", JSON.stringify(value)), theme);
  await page.goto("/");
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
}

test.describe("desktop reply card", () => {
  test("Jev steps aside for a reply with blocks and the card stays until closed", async ({ page }) => {
    await mockTalk(page, [{ spoken: "Te cuento cómo funciona.", blocks: longBlocks }]);
    await open(page);
    const presence = page.locator(".creature-presence");
    const center = async () => { const box = (await presence.boundingBox())!; return box.x + box.width / 2; };
    const centered = await center();
    await send(page, "explícame la fotosíntesis");

    const card = page.getByRole("region", { name: "Respuesta de Jev" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Te cuento cómo funciona.");
    await expect(card).toContainText("El ciclo de Calvin fija el CO₂ en glucosa.");
    await expect(page.locator(".speech-caption")).toHaveCount(0);
    await expect.poll(center).toBeLessThan(centered - 150);
    await expect(page.locator(INPUT)).toBeInViewport();
    await stageIsSingleScreen(page);
    await capture(page, "desktop-card-light");

    // The 5 s caption fade does not apply to a reply with blocks.
    await page.waitForTimeout(6_000);
    await expect(card).toBeVisible();

    await page.getByRole("button", { name: "Cerrar respuesta" }).click();
    await expect(card).toHaveCount(0);
    await expect.poll(async () => Math.abs(await center() - centered)).toBeLessThan(4);
  });

  test("Jev keeps her round shape while stepping aside and back", async ({ page }) => {
    await mockTalk(page, [{ spoken: "Te cuento cómo funciona.", blocks: longBlocks }]);
    await open(page);
    const card = page.getByRole("region", { name: "Respuesta de Jev" });
    const opening = await characterAspectsDuring(page, () => send(page, "explícame la fotosíntesis"));
    await expect(card).toBeVisible();
    const closing = await characterAspectsDuring(page, () => page.getByRole("button", { name: "Cerrar respuesta" }).click());
    await expect(card).toHaveCount(0);
    expect(closing.length).toBeGreaterThan(10);
    for (const aspect of [...opening, ...closing]) expect(aspect).toBeCloseTo(1, 1);
  });

  test("starts reading at the top and offers More for hidden content", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await mockTalk(page, [{ spoken: "Te cuento cómo funciona.", blocks: longBlocks }]);
    await open(page);
    await send(page, "explícame la fotosíntesis");

    const scroller = page.locator(".reply-card .reply__scroll");
    await expect(scroller).toContainText("Por eso las plantas");
    expect(await scroller.evaluate(element => element.scrollTop)).toBe(0);
    const more = page.getByRole("button", { name: "Más" });
    await expect(more).toBeVisible();
    await more.click();
    await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await stageIsSingleScreen(page);
  });

  test("Escape closes the card and a new message replaces it", async ({ page }) => {
    await mockTalk(page, [
      { spoken: "Te cuento cómo funciona.", blocks: longBlocks },
      { spoken: "Hola de nuevo.", blocks: [] },
      { spoken: "Otra explicación.", blocks: longBlocks.slice(0, 2) },
      { spoken: "Adiós.", blocks: [] },
    ]);
    await open(page);
    const card = page.getByRole("region", { name: "Respuesta de Jev" });

    await send(page, "explícame la fotosíntesis");
    await expect(card).toBeVisible();
    await page.locator(".reply-card .reply__scroll").focus();
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await expect(page.locator(INPUT)).toBeFocused();

    await send(page, "hola");
    await expect(page.locator(".speech-caption")).toContainText("Hola de nuevo.");
    await expect(card).toHaveCount(0);

    await send(page, "otra");
    await expect(card).toContainText("Otra explicación.");
    await send(page, "hola");
    await expect(card).toHaveCount(0);
  });

  test("dark theme keeps the card readable", async ({ page }) => {
    await mockTalk(page, [{ spoken: "Te cuento cómo funciona.", blocks: longBlocks }]);
    await open(page, "dark");
    await send(page, "explícame la fotosíntesis");
    await expect(page.getByRole("region", { name: "Respuesta de Jev" })).toBeVisible();
    await stageIsSingleScreen(page);
    await capture(page, "desktop-card-dark");
  });
});

test.describe("mobile reply sheet", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("previews the reply above the input and opens it in a sheet", async ({ page }) => {
    await mockTalk(page, [{ spoken: "Te cuento cómo funciona, paso a paso y con un ejemplo.", blocks: longBlocks }]);
    await open(page);
    await send(page, "explícame la fotosíntesis");

    const readAll = page.getByRole("button", { name: "Leer todo" });
    await expect(readAll).toBeVisible();
    await expect(page.locator(".reply-preview")).toContainText("Te cuento cómo funciona");
    await expect(page.locator(".reply-card")).toHaveCount(0);
    await stageIsSingleScreen(page);
    await capture(page, "mobile-preview-light");

    await readAll.click();
    const sheet = page.getByRole("dialog", { name: "Jev responde" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("El ciclo de Calvin fija el CO₂ en glucosa.");
    await expect(page.locator(".reply-sheet .reply__eyebrow")).toBeFocused();
    await expect(page.locator(INPUT)).toBeVisible();
    await page.waitForTimeout(500);
    await capture(page, "mobile-sheet-half-light");

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(readAll).toBeFocused();

    // The preview's own close discards the reply.
    await page.getByRole("button", { name: "Cerrar respuesta" }).click();
    await expect(page.locator(".reply-preview")).toHaveCount(0);
  });

  test("the handle expands the sheet and dragging it down returns to the preview", async ({ page }) => {
    await mockTalk(page, [{ spoken: "Te cuento cómo funciona.", blocks: longBlocks }]);
    await open(page, "dark");
    await send(page, "explícame la fotosíntesis");
    await page.getByRole("button", { name: "Leer todo" }).click();

    const handle = page.getByRole("button", { name: "Arrastra para ajustar el panel" });
    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await handle.click();
    await expect(handle).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => (await page.locator(".reply-sheet").boundingBox())!.y).toBeLessThan(120);
    // Measure the handle only once the sheet has settled at full height.
    await page.waitForTimeout(500);
    await capture(page, "mobile-sheet-full-dark");

    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 300, { steps: 12 });
    await page.mouse.move(box.x + box.width / 2, box.y + 650, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".reply-preview")).toBeVisible();
  });
});

test.describe("narrow and short viewports", () => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    test(`reflows without page scroll at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockTalk(page, [{ spoken: "Te cuento cómo funciona, paso a paso y con un ejemplo.", blocks: longBlocks }]);
      await open(page);
      await send(page, "explícame la fotosíntesis");
      await expect(page.getByRole("button", { name: "Leer todo" })).toBeVisible();
      await expect(page.locator(INPUT)).toBeInViewport();
      await stageIsSingleScreen(page);
      await capture(page, `preview-${viewport.width}x${viewport.height}`);
      await page.getByRole("button", { name: "Leer todo" }).click();
      const sheet = page.getByRole("dialog", { name: "Jev responde" });
      await expect(sheet).toBeVisible();
      await page.getByRole("button", { name: "Más" }).or(page.getByRole("button", { name: "Volver a la vista previa" })).first().waitFor();
      await stageIsSingleScreen(page);
      await page.waitForTimeout(500);
      await capture(page, `sheet-${viewport.width}x${viewport.height}`);
      await page.getByRole("button", { name: "Volver a la vista previa" }).click();
      await expect(sheet).toHaveCount(0);
    });
  }
});
