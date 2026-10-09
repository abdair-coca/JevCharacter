import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(45000);
const errors = []; const checks = []; let requests = 0;
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/**', async route => { requests++; await route.fulfill({ status: 503, body: '{"unavailable":true}' }); });
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log(`PASS ${name}`); };
const visit = async route => {
  await page.locator(`.site-header nav a[href="${route}"]`).click();
  await page.locator('main:visible .character-rive[data-ready="true"]').waitFor({ state: 'attached' });
};
try {
  await page.goto('http://127.0.0.1:4175/');
  await page.locator('.character-rive[data-ready="true"]').waitFor();
  await page.locator('.character-rive canvas').evaluate(canvas => { canvas.dataset.sessionProbe = 'retained'; });
  await page.getByRole('textbox').fill('Borrador conservado');
  for (let pass = 0; pass < 2; pass++) {
    await visit('/features');
    await page.locator('[data-chapter-card="2"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await visit('/about');
    await page.locator('[data-story-scene="4"]').evaluate(el => scrollTo({ top: el.getBoundingClientRect().top + scrollY - 88, behavior: 'instant' }));
    await page.waitForTimeout(1200);
    check(`Story scroll engine active on visit ${pass + 1}`, await page.locator('.story-particles').getAttribute('data-running') === 'true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('Live reduced motion pauses particles', await page.locator('.story-particles').getAttribute('data-running') === 'false');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(400);
    await visit('/');
    check('Home retains its canvas', await page.locator('.home-session canvas').getAttribute('data-session-probe') === 'retained');
    check('Home retains the draft', await page.getByRole('textbox').inputValue() === 'Borrador conservado');
    check('No stale pin wrappers in Home', await page.locator('.pin-spacer').count() === 0);
  }
  check('Navigation makes no API calls', requests === 0);
  check('No application errors', errors.length === 0);
  await writeFile(new URL('./lifecycle.json', import.meta.url), JSON.stringify({ checks, errors, requests, date: new Date().toISOString() }, null, 2));
} finally { await browser.close(); }
