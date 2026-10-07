// Run with the Playwright MCP browser_run_code filename tool against the preview server.
// All provider endpoints are intercepted; screenshots use the existing Character asset.
async (page) => {
  const run = async () => {
  const browser = page.context().browser();
  const origin = "http://127.0.0.1:5174";
  const report = { checks: [], screenshots: [], errors: [], warnings: [], failures: [], conditions: "Chromium desktop / mobile emulation; production preview; mocked API; no physical keyboard/device measurement" };
  page.__phase1Report = report;
  const assert = (value, message) => { if (!value) throw new Error(message); report.checks.push(message); };
  const observe = (p, label) => {
    p.on("pageerror", (error) => report.errors.push(`${label}: ${error.message}`));
    p.on("console", (message) => {
      if (message.type() === "error") report.errors.push(`${label}: ${message.text()}`);
      if (message.type() === "warning") report.warnings.push(`${label}: ${message.text()}`);
    });
  };
  for (const mobile of (page.__phase1InteractionOnly ? [] : [false, true])) {
    for (const theme of ["light", "dark"]) {
      for (const language of ["es", "en"]) {
        const label = `${mobile ? "mobile" : "desktop"}-${theme}-${language}`;
        const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, locale: language === "es" ? "es-BO" : "en-US", colorScheme: theme });
        const p = await context.newPage();
        p.setDefaultTimeout(7000);
        p.setDefaultNavigationTimeout(15000);
        observe(p, label);
        let requests = 0;
        await context.route("**/api/**", (route) => { requests++; return route.fulfill({ status: 200, contentType: "application/json", body: '{"unavailable":true}' }); });
        try {
          await p.goto(origin);
          await p.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 20000 });
          await p.waitForTimeout(200);
          const geometry = await p.evaluate(() => {
            const input = document.querySelector("input").getBoundingClientRect();
            return { theme: document.documentElement.dataset.theme, lang: document.documentElement.lang, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, inputBottom: input.bottom, viewport: innerHeight };
          });
          assert(geometry.theme === theme && geometry.lang === language, `${label}: initial theme and language`);
          assert(geometry.width <= (mobile ? 390 : 1440), `${label}: no horizontal overflow`);
          assert(geometry.inputBottom <= geometry.viewport, `${label}: input visible on initial viewport`);
          if (mobile) await p.locator("canvas").tap();
          assert(requests === 0, `${label}: pointer/touch interaction does not invoke AI`);
          const screenshot = `.dev/evidence/phase-1/home-${label}.png`;
          await p.screenshot({ path: screenshot, fullPage: true });
          report.screenshots.push(screenshot);
          await p.locator("input").fill("Mi borrador");
          await p.getByRole("button", { name: language === "es" ? "English" : "Español", exact: true }).click();
          await p.getByRole("combobox").selectOption(theme === "dark" ? "light" : "dark");
          assert(await p.locator("input").inputValue() === "Mi borrador", `${label}: preferences preserve draft`);
          await p.locator(".brain-hud__summary").click();
          assert(await p.locator("#brain-details").isVisible(), `${label}: HUD details accessible`);
        } catch (error) { report.failures.push(`${label}: ${error.message}`); }
        await context.close();
      }
    }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-BO", colorScheme: "light" });
  const p = await context.newPage();
  p.setDefaultTimeout(7000);
  p.setDefaultNavigationTimeout(15000);
  observe(p, "interaction");
  const bodies = [];
  let action = { kind: "reaction", reaction: "HELLO" };
  let unavailable = false;
  await context.route("**/api/decide", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(unavailable ? { unavailable: true } : {
      action, actionConfidence: 0.9, reaction: "HELLO", reactionConfidence: 0.9,
      probabilities: { BASE: 0.1, HELLO: 0.8, GHOST: 0.05, FLOWER: 0.05 }, intensity: 0.4, wantsAttention: 0.3, source: "jev",
    }) });
  });
  await context.route("**/api/talk", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: 'event: delta\ndata: {"text":"Hola, estoy aquí."}\n\nevent: done\ndata: {}\n\n' }));
  try {
    await p.goto(origin);
    await p.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 20000 });
    await p.keyboard.press("Tab");
    assert(await p.getByRole("link", { name: "Ir al contenido" }).evaluate((element) => element === document.activeElement), "keyboard: skip link is first tab stop");
    await p.keyboard.press("Enter");
    assert(await p.locator("#page-title").evaluate((element) => element === document.activeElement), "keyboard: skip link reaches title");
    const canvas = await p.locator("canvas").elementHandle();
    await p.getByRole("button", { name: "English", exact: true }).click();
    await p.getByRole("combobox").selectOption("dark");
    assert(await canvas.evaluate((element) => element.isConnected), "preferences: character is not remounted");
    await p.reload();
    assert(await p.evaluate(() => document.documentElement.lang === "en" && document.documentElement.dataset.theme === "dark"), "preferences: manual theme and language survive reload");
    await p.getByRole("combobox").selectOption("system");
    await p.emulateMedia({ colorScheme: "light" });
    await p.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await p.emulateMedia({ colorScheme: "dark" });
    await p.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await p.getByRole("combobox").selectOption("light");
    await p.emulateMedia({ colorScheme: "dark" });
    assert(await p.evaluate(() => document.documentElement.dataset.theme === "light"), "preferences: system changes do not replace manual choice");
    await p.getByRole("button", { name: "Español", exact: true }).click();
    await p.locator("input").fill("   ");
    await p.locator("input").press("Enter");
    assert(bodies.length === 0, "input: blank context makes no request");
    await p.mouse.move(150, 300);
    await p.mouse.move(800, 400);
    await p.waitForTimeout(100);
    assert(await p.locator(".home-page").evaluate((element) => element.style.getPropertyValue("--pointer-x") !== ""), "pointer: local sensor updates visual position");
    assert(bodies.length === 0, "pointer: movement makes no request");
    for (const example of [
      { message: "Hola Jev", action: { kind: "reaction", reaction: "HELLO" }, label: "Saluda" },
      { message: "¿Es correcto?", action: { kind: "answer", answer: "yes" }, label: "Sí" },
      { message: "Transforma en triángulo", action: { kind: "morph", form: "triangle" }, label: "Triángulo" },
      { message: "Explícame algo", action: { kind: "talk", state: "talkb" }, label: "Habla" },
    ]) {
      action = example.action;
      await p.locator("input").fill(example.message);
      await p.locator("input").press("Enter");
      await p.waitForFunction((label) => document.querySelector(".brain-hud__headline").textContent === label, example.label);
      assert(true, `input: ${example.action.kind} updates real HUD through mocked decision`);
    }
    await p.getByText("Hola, estoy aquí.", { exact: true }).first().waitFor();
    assert(true, "speech: mocked SSE caption appears");
    unavailable = true;
    await p.locator("input").fill("Estoy aquí otra vez");
    await p.locator("input").press("Enter");
    await p.getByText("Instinto local", { exact: true }).waitFor();
    assert(true, "fallback: decision unavailable keeps local reaction and source label");
    for (let i = 0; i < 3; i++) {
      await p.getByRole("link", { name: "Capacidades", exact: true }).click();
      await p.waitForFunction(() => document.activeElement?.id === "page-title");
      assert(await p.locator("canvas").count() === 0, `navigation ${i}: Home unmounted on provisional Features`);
      await p.getByRole("link", { name: "Historia", exact: true }).click();
      await p.getByRole("heading", { name: "Historia", exact: true }).waitFor();
      await p.goBack();
      await p.getByRole("heading", { name: "Capacidades", exact: true }).waitFor();
      await p.goForward();
      await p.getByRole("heading", { name: "Historia", exact: true }).waitFor();
      await p.reload();
      await p.getByRole("heading", { name: "Historia", exact: true }).waitFor();
      await p.getByRole("link", { name: "Inicio", exact: true }).click();
      await p.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 20000 });
    }
    assert(true, "navigation: three repeated cycles, back/forward and direct reloads");
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator("input").focus();
    await p.setViewportSize({ width: 390, height: 420 });
    await p.locator("input").scrollIntoViewIfNeeded();
    const reachable = await p.locator("input").evaluate((element) => { const box = element.getBoundingClientRect(); return box.top >= 120 && box.bottom <= innerHeight; });
    assert(reachable, "mobile keyboard simulation: input reachable with 420px viewport height");
    await p.screenshot({ path: ".dev/evidence/phase-1/mobile-short-viewport.png", fullPage: true });
    await p.setViewportSize({ width: 320, height: 568 });
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "reflow: 320px width without horizontal overflow");
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.reload();
    await p.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 20000 });
    await p.locator(".brain-hud__summary").click();
    assert(await p.locator("#brain-details").isVisible(), "reduced motion: content and HUD remain accessible");
    await p.screenshot({ path: ".dev/evidence/phase-1/mobile-reduced-motion.png", fullPage: true });
    await p.waitForTimeout(2200);
  } catch (error) { report.failures.push(`interaction: ${error.message}`); }
  await context.close();

  const firstPaint = await browser.newContext({ colorScheme: "light", locale: "en-US" });
  await firstPaint.addInitScript(() => { localStorage.setItem("jevling.theme", '"dark"'); localStorage.setItem("jevling.language", '"es"'); });
  const firstPage = await firstPaint.newPage();
  firstPage.setDefaultTimeout(7000);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await firstPaint.route("**/assets/index-*.js", async (route) => { await gate; await route.continue(); });
  try {
    await firstPage.goto(origin, { waitUntil: "commit" });
    await firstPage.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    assert(await firstPage.evaluate(() => document.documentElement.lang === "es" && document.querySelector('meta[name="theme-color"]').content === "#050608" && !document.querySelector("#root")?.children.length), "first paint: saved theme, language and browser chrome applied before React");
  } catch (error) { report.failures.push(`first paint: ${error.message}`); }
  release();
  await firstPaint.close();
  return report;
  };
  page.__phase1Done = false;
  run().then(() => { page.__phase1Done = true; }).catch((error) => {
    page.__phase1Report.failures.push(`harness: ${error.message}`);
    page.__phase1Done = true;
  });
  return "Browser verification started; poll __phase1Done / __phase1Report with browser_run_code.";
}
