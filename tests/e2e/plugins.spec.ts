import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const INPUT = "#creature-context";
const EVIDENCE = process.env.PLUGINS_EVIDENCE;
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
const talkDecision = {
  action: { kind: "talk", state: "talkb" },
  actionConfidence: 0.9, reaction: "BASE", reactionConfidence: 0.9,
  probabilities: { BASE: 0.8, HELLO: 0.1, GHOST: 0.05, FLOWER: 0.05, QUESTION: 0 },
  intensity: 0.4, wantsAttention: 0.3, source: "jev",
};
const DRAFT = "Hola, llego 10 minutos tarde. ¡Guárdenme un lugar!";

/** Jev answers with a GitHub source and a WhatsApp draft; returns the plugins each message sent. */
async function mockPluginReply(page: Page) {
  const sent: string[][] = [];
  await page.route("**/api/decide", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(talkDecision) }));
  await page.route("**/api/talk", route => {
    sent.push((route.request().postDataJSON() as { plugins: string[] }).plugins);
    const events = [
      ["tool", { plugin: "github" }],
      ["spoken", { text: "React tiene unas 230 mil estrellas. Te dejo el mensaje listo." }],
      ["block", { block: { type: "paragraph", text: "La librería de interfaces de Meta sigue muy activa: su último cambio es de esta semana." } }],
      ["block", { block: { type: "whatsapp", text: DRAFT } }],
      ["block", { block: { type: "links", items: [{ label: "facebook/react", url: "https://github.com/facebook/react" }] } }],
      ["done", {}],
    ];
    return route.fulfill({ status: 200, contentType: "text/event-stream", body: events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("") });
  });
  return sent;
}

async function ask(page: Page) {
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
  await page.locator(INPUT).fill("¿cuántas estrellas tiene react? y avísale a mi grupo por whatsapp que llego tarde");
  await page.locator(INPUT).press("Enter");
}

for (const theme of ["light", "dark"] as const) {
  for (const device of ["desktop", "mobile"] as const) {
    test(`sources and a WhatsApp draft fit the reply (${device}, ${theme})`, async ({ page }) => {
      await page.setViewportSize(viewports[device]);
      await page.addInitScript((mode) => window.localStorage.setItem("jevling.theme", JSON.stringify(mode)), theme);
      await mockPluginReply(page);
      await page.goto("/");
      await ask(page);

      const reply = device === "desktop" ? page.getByRole("region", { name: "Respuesta de Jev" }) : page.getByRole("dialog", { name: "Jev responde" });
      const open = reply.getByRole("link", { name: /Abrir en WhatsApp/ });
      await expect(open).toBeVisible();
      const href = new URL(String(await open.getAttribute("href")));
      expect(href.origin).toBe("https://wa.me");
      expect(href.searchParams.get("text")).toBe(DRAFT);
      const source = reply.getByRole("navigation", { name: "Fuentes" }).getByRole("link", { name: /facebook\/react/ });
      await source.scrollIntoViewIfNeeded();
      await expect(source).toHaveAttribute("href", "https://github.com/facebook/react");
      await expect(source).toHaveAttribute("target", "_blank");
      const box = await reply.boundingBox();
      expect(box && box.x + box.width).toBeLessThanOrEqual(viewports[device].width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/plugins-${device}-${theme}.png` });
    });
  }
}

test("a plugin switched off in Ajustes stops travelling with each message", async ({ page }) => {
  const sent = await mockPluginReply(page);
  await page.goto("/");
  await ask(page);
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual(["github", "whatsapp"]);

  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  const plugins = page.getByRole("dialog", { name: "Ajustes" }).getByRole("region", { name: "Plugins" });
  await plugins.getByRole("button", { name: "GitHub", exact: true }).click();
  await expect(plugins.getByRole("button", { name: "GitHub", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");

  await ask(page);
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toEqual(["whatsapp"]);
});
