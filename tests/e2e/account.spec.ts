import type { Page, Route } from "@playwright/test";
import { expect, test } from "./fixtures";

// playwright.config builds the app against this fake project; every call to it is answered here.
const SUPABASE = "https://jev-e2e.supabase.co";
const USER = { id: "00000000-0000-4000-8000-0000000000e2", email: "ana@example.com", aud: "authenticated", role: "authenticated" };
type Row = { id: string; text: string; created_at: string };

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** A session as supabase-js saves it, valid for an hour so it never refreshes during the test. */
function savedSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: USER.id, role: "authenticated", aud: "authenticated", email: USER.email, exp: expiresAt })}.e2e`;
  return { access_token: token, refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: USER };
}

// The browser asks before sending supabase-js's headers to another origin; the fake project allows them.
function cors(route: Route) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": route.request().headers()["access-control-request-headers"] ?? "*",
  };
}

/** The memories table behind RLS for one visitor; returns its rows and the writes it received. */
async function fakeProject(page: Page, rows: Row[]) {
  const writes: string[] = [];
  await page.route(`${SUPABASE}/rest/v1/memories**`, route => {
    const request = route.request();
    const headers = cors(route);
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() === "GET") {
      const newest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(newest) });
    }
    if (request.method() === "POST") {
      const inserted = request.postDataJSON() as Row[];
      rows.push(...inserted);
      writes.push(`insert ${inserted.map(row => row.text).join(" | ")}`);
      return route.fulfill({ status: 201, headers, body: "" });
    }
    if (request.method() === "DELETE") {
      const id = new URL(request.url()).searchParams.get("id")?.replace(/^eq\./, "");
      rows.splice(rows.findIndex(row => row.id === id), 1);
      writes.push(`delete ${id}`);
      return route.fulfill({ status: 204, headers });
    }
    return route.fulfill({ status: 405, headers });
  });
  await page.route(`${SUPABASE}/auth/v1/**`, route => route.fulfill({ status: 204, headers: cors(route) }));
  return writes;
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  return page.getByRole("dialog", { name: "Ajustes" });
}

test("signed in, Jev's notes come from the account: move this browser's, forget one, sign out", async ({ page }) => {
  const day = 86_400_000;
  const rows: Row[] = [{ id: "row-1", text: "Le gusta programar.", created_at: new Date(Date.now() - 2 * day).toISOString() }];
  const writes = await fakeProject(page, rows);
  await page.addInitScript(([session, notes]) => {
    // Only on the first load: signing out must stay signed out.
    if (window.sessionStorage.getItem("e2e.seeded")) return;
    window.sessionStorage.setItem("e2e.seeded", "1");
    window.localStorage.setItem("jevling.auth", JSON.stringify(session));
    window.localStorage.setItem("jevling.memory", JSON.stringify({ version: 1, notes }));
  }, [savedSession(), [{ id: "local-1", text: "Vive en Potosí.", createdAt: Date.now() - day }]] as const);
  await page.goto("/");

  const settings = await openSettings(page);
  const account = settings.getByRole("region", { name: "Cuenta" });
  await expect(account.getByRole("status")).toHaveText("Sesión iniciada como ana@example.com");
  await settings.getByRole("button", { name: "Memoria" }).click();

  const memory = page.getByRole("dialog", { name: "Lo que Jev recuerda" });
  await expect(memory.getByRole("status")).toHaveText("Guardado en tu cuenta.");
  await expect(memory.getByText("Le gusta programar.")).toBeVisible();
  await memory.getByRole("button", { name: "Llevar 1 nota a tu cuenta" }).click();
  await expect(memory.getByText("Vive en Potosí.")).toBeVisible();
  await expect(memory.getByRole("button", { name: /Llevar/ })).toHaveCount(0);
  expect(writes).toEqual(["insert Vive en Potosí."]);
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem("jevling.memory") ?? "null").notes)).toEqual([]);

  await memory.getByRole("button", { name: "Olvidar: Le gusta programar." }).click();
  await expect(memory.getByText("Le gusta programar.")).toHaveCount(0);
  await expect.poll(() => writes).toEqual(["insert Vive en Potosí.", "delete row-1"]);
  expect(rows.map(row => row.text)).toEqual(["Vive en Potosí."]);
  await page.keyboard.press("Escape");

  await (await openSettings(page)).getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Iniciar sesión con Google" })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter(key => key.startsWith("jevling.auth")))).toEqual([]);
  await page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Memoria" }).click();
  await expect(memory.getByRole("status")).toHaveText("Se guarda solo en este navegador.");
  await expect(memory.getByText("Todavía no recuerdo nada de ti.")).toBeVisible();
});

test("signed out, Supabase is not contacted until Google sign-in, which returns to the same view", async ({ page }) => {
  const contacted: string[] = [];
  page.on("request", request => { if (request.url().startsWith(SUPABASE)) contacted.push(request.url()); });
  await page.route(`${SUPABASE}/auth/v1/authorize**`, route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google</title>" }));
  await page.goto("/about");

  const settings = await openSettings(page);
  await expect(settings.getByRole("region", { name: "Cuenta" })).toBeVisible();
  expect(contacted).toEqual([]);

  await settings.getByRole("button", { name: "Iniciar sesión con Google" }).click();
  await page.waitForURL(`${SUPABASE}/auth/v1/authorize**`);
  const authorize = new URL(page.url());
  expect(authorize.searchParams.get("provider")).toBe("google");
  expect(authorize.searchParams.get("redirect_to")).toBe("http://127.0.0.1:4173/about");
  expect(authorize.searchParams.get("code_challenge_method")).toBe("s256");
});
