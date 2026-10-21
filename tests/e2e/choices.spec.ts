import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const INPUT = "#creature-context";
const EVIDENCE = process.env.REPLY_EVIDENCE;

const talkDecision = {
  action: { kind: "talk", state: "talkb" },
  actionConfidence: 0.9, reaction: "BASE", reactionConfidence: 0.9,
  probabilities: { BASE: 0.8, HELLO: 0.1, GHOST: 0.05, FLOWER: 0.05, QUESTION: 0 },
  intensity: 0.4, wantsAttention: 0.3, source: "jev",
};

const question = { type: "choices", question: "¿Qué te atrae más de la tecnología?", options: ["Programar", "Diseñar interfaces", "Analizar datos", "Redes y seguridad"] };
const followUp = { type: "choices", question: "¿Prefieres una carrera corta o larga?", options: ["Corta", "Larga"] };
const advice = { type: "list", items: ["Ingeniería de Sistemas", "Ciencias de la Computación"] };

function sse(spoken: string, blocks: unknown[]) {
  return [
    `event: spoken\ndata: ${JSON.stringify({ text: spoken })}\n\n`,
    ...blocks.map(block => `event: block\ndata: ${JSON.stringify({ block })}\n\n`),
    "event: done\ndata: {}\n\n",
  ].join("");
}

/** Counts decisions and records each talk message; replies follow the queue. */
async function mockConversation(page: Page) {
  const calls = { decide: 0, talk: [] as string[] };
  const replies = [
    sse("¡Te ayudo a elegir! ¿Qué te atrae más?", [question]),
    sse("Programar es un gran camino. ¿Corta o larga?", [followUp]),
    sse("Estas carreras encajan contigo.", [advice]),
  ];
  await page.route("**/api/decide", route => {
    calls.decide++;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(talkDecision) });
  });
  await page.route("**/api/talk", route => {
    calls.talk.push((route.request().postDataJSON() as { message: string }).message);
    return route.fulfill({ status: 200, contentType: "text/event-stream", body: replies[Math.min(calls.talk.length - 1, replies.length - 1)] });
  });
  return calls;
}

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
}

async function send(page: Page, text: string) {
  await page.locator(INPUT).fill(text);
  await page.locator(INPUT).press("Enter");
}

test("desktop: an option and a typed answer both continue the conversation without a new decision", async ({ page }) => {
  const calls = await mockConversation(page);
  await open(page);
  await send(page, "¿qué carrera puedo estudiar?");

  const group = page.getByRole("group", { name: "¿Qué te atrae más de la tecnología?" });
  await expect(group.getByRole("button")).toHaveCount(4);
  await expect(page.getByText("O escríbeme tu respuesta.")).toBeVisible();
  if (EVIDENCE) { await page.waitForTimeout(2_000); await page.screenshot({ path: `${EVIDENCE}/choices-desktop.png` }); }
  expect(calls.decide).toBe(1);

  await group.getByRole("button", { name: "Programar" }).click();
  await expect(page.getByRole("group", { name: "¿Prefieres una carrera corta o larga?" })).toBeVisible();
  expect(calls.talk).toEqual(["¿qué carrera puedo estudiar?", "Programar"]);

  await send(page, "algo corto, necesito trabajar pronto");
  await expect(page.getByText("Ingeniería de Sistemas")).toBeVisible();
  expect(calls.talk.at(-1)).toBe("algo corto, necesito trabajar pronto");
  expect(calls.decide).toBe(1);

  // Jev asked nothing this time, so the next message is decided again.
  await send(page, "gracias");
  await expect.poll(() => calls.decide).toBe(2);
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("answers from the sheet that opens on its own", async ({ page }) => {
    const calls = await mockConversation(page);
    await open(page);
    await send(page, "¿qué carrera puedo estudiar?");

    const sheet = page.getByRole("dialog", { name: "Jev responde" });
    const options = sheet.getByRole("group", { name: "¿Qué te atrae más de la tecnología?" });
    await expect(options.getByRole("button")).toHaveCount(4);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    if (EVIDENCE) { await page.waitForTimeout(2_000); await page.screenshot({ path: `${EVIDENCE}/choices-mobile.png` }); }

    await options.getByRole("button", { name: "Programar" }).click();
    await expect(sheet.getByRole("button", { name: "Corta" })).toBeVisible();
    expect(calls.talk).toEqual(["¿qué carrera puedo estudiar?", "Programar"]);
    expect(calls.decide).toBe(1);
  });
});
