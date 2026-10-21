import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const INPUT = "#creature-context";

const talkDecision = {
  action: { kind: "talk", state: "talkb" },
  actionConfidence: 0.9, reaction: "BASE", reactionConfidence: 0.9,
  probabilities: { BASE: 0.8, HELLO: 0.1, GHOST: 0.05, FLOWER: 0.05, QUESTION: 0 },
  intensity: 0.4, wantsAttention: 0.3, source: "jev",
};

/** Every message makes Jev talk; the first reply carries a memory note. Returns the request bodies. */
async function mockTalk(page: Page) {
  const bodies: { message: string; memory: string[] }[] = [];
  await page.route("**/api/decide", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(talkDecision) }));
  await page.route("**/api/talk", route => {
    bodies.push(route.request().postDataJSON() as { message: string; memory: string[] });
    const memory = bodies.length === 1 ? `event: memory\ndata: ${JSON.stringify({ text: "Le interesa la programación y duda de qué carrera estudiar." })}\n\n` : "";
    const body = `event: spoken\ndata: ${JSON.stringify({ text: "Te ayudo con eso." })}\n\n${memory}event: done\ndata: {}\n\n`;
    return route.fulfill({ status: 200, contentType: "text/event-stream", body });
  });
  return bodies;
}

async function send(page: Page, text: string) {
  await page.locator(INPUT).fill(text);
  await page.locator(INPUT).press("Enter");
}

test("Jev remembers a note after reloading and sends it with a related question", async ({ page }) => {
  const bodies = await mockTalk(page);
  await page.goto("/");
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });

  await send(page, "me gusta programar, ¿qué carrera estudio?");
  await expect(page.locator(".speech-caption")).toContainText("Te ayudo con eso.");
  expect(bodies[0].memory).toEqual([]);
  // The note is hidden: it never shows on screen.
  await expect(page.getByText("Le interesa la programación")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
  await send(page, "¿y qué carreras de programación hay?");
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1].memory).toEqual(["Le interesa la programación y duda de qué carrera estudiar."]);
});
