import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const [size = 'desktop', theme = 'dark', language = 'es', mode = 'motion'] = process.argv.slice(2);
const viewport = size === 'desktop' ? { width: 1440, height: 900 } : size === 'short' ? { width: 390, height: 420 } : size === 'narrow' ? { width: 320, height: 568 } : { width: 390, height: 844 };
const directory = fileURLToPath(new URL('./', import.meta.url));
const id = [size, theme, language, mode].join('-');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport, isMobile: size !== 'desktop', hasTouch: size !== 'desktop', reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
await context.addInitScript(({ theme, language }) => {
  localStorage.setItem('jevling.theme', JSON.stringify(theme));
  localStorage.setItem('jevling.language', JSON.stringify(language));
}, { theme, language });
const page = await context.newPage(); page.setDefaultTimeout(45000);
const errors = []; const checks = []; const screenshots = []; let requests = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/404|503/.test(message.text())) errors.push(message.text()); });
await page.route('**/api/**', async route => { requests++; await route.fulfill({ status: 503, body: '{"unavailable":true}', contentType: 'application/json' }); });
if (mode === 'fallback') await page.route('**/rive/prove2.riv', route => route.fulfill({ status: 404, body: '' }));
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log(`PASS ${name}`); };
const screenshot = async label => { const path = `${id}-${label}.png`; await page.screenshot({path: `${directory}/${path}`}); screenshots.push(path); };
const state = async phase => page.waitForFunction(value => document.querySelector('main')?.dataset.enrollment === value, phase);
const open = async () => {
  await page.locator('#creature-context').fill(language === 'es' ? 'Quiero inscribirme en la UATF' : "I'd like to register");
  await page.locator('#creature-context').press('Enter'); await state('editing');
};
const formButton = () => page.locator('.enrollment form button[type="submit"]');
try {
  await page.goto('http://127.0.0.1:4175/');
  if (mode !== 'fallback') await page.locator('.character-rive[data-ready="true"]').waitFor();
  await page.waitForTimeout(1200);
  check('Requested preferences applied', await page.evaluate(({theme, language}) => document.documentElement.dataset.theme === theme && document.documentElement.lang === language, {theme, language}));
  const initial = await page.locator('.whisper').boundingBox();
  await page.locator('.character-rive').evaluate(el => { el.dataset.enrollmentProbe = 'same'; });
  await open(); await page.waitForTimeout(950);
  check('Both fields visible together', await page.locator('#enrollment-name').isVisible() && await page.locator('#enrollment-phone').isVisible());
  check('Conversational controls are inert', await page.locator('.home-controls').evaluate(el => el.inert));
  check('One persistent character', await page.locator('.character-rive').count() === 1 && await page.locator('.character-rive').getAttribute('data-enrollment-probe') === 'same');
  check('No horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (size !== 'desktop') {
    const art = await page.locator('.creature-zone').boundingBox(); const form = await page.locator('.enrollment').boundingBox();
    check('Jev is above the mobile form', art.y + art.height <= form.y + 2);
  }
  await screenshot('open');
  await formButton().click();
  check('Empty fields produce two inline errors', await page.locator('.enrollment__error').count() === 2);
  check('Invalid submission focuses the name', await page.locator('#enrollment-name').evaluate(el => el === document.activeElement));
  await page.locator('#enrollment-name').fill('Estudiante de Prueba');
  await page.locator('#enrollment-phone').fill('123');
  await formButton().click();
  check('Invalid mobile stays editable', await page.locator('#enrollment-phone').getAttribute('aria-invalid') === 'true' && await page.locator('#enrollment-name').inputValue() === 'Estudiante de Prueba');
  await screenshot('validation');
  await page.locator('#enrollment-phone').fill('+591 7000-0000');
  // Exercise the real preferences controls without replacing the form.
  const other = language === 'es' ? 'English' : 'Español';
  await page.locator('.language-switch').getByRole('button', {name: other, exact: true}).click();
  await page.locator('.theme-toggle').click();
  check('Preferences preserve both fields', await page.locator('#enrollment-name').inputValue() === 'Estudiante de Prueba' && await page.locator('#enrollment-phone').inputValue() === '+591 7000-0000');
  await page.locator('.language-switch').getByRole('button', {name: language === 'es' ? 'Español' : 'English', exact: true}).click();
  await page.locator('.theme-toggle').click();
  if (size !== 'desktop' && mode !== 'fallback') {
    await page.locator('#enrollment-phone').focus();
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 380 });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(900);
    const main = await page.locator('.home-page').boundingBox();
    check('Form respects the visual viewport with simulated keyboard', main.y + main.height <= 381);
    await formButton().scrollIntoViewIfNeeded();
    const button = await formButton().boundingBox();
    check('Confirmation remains reachable above keyboard', button.y + button.height <= 381);
    await screenshot('keyboard');
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
  }
  await page.locator('#enrollment-phone').focus(); await page.locator('#enrollment-phone').press('Enter');
  await state('confirmed'); await page.waitForTimeout(600);
  check('Confirmation is local and removes input values', await page.locator('#enrollment-name, #enrollment-phone').count() === 0);
  check('Completion heading is visible', await page.locator('.enrollment__eyebrow').isVisible());
  check('Demo wording remains visible', await page.locator('.enrollment__demo').isVisible());
  if (mode === 'reduced') check('No particle animation with reduced motion', await page.locator('.enrollment-particles').count() === 0);
  if (mode === 'fallback') check('Character failure leaves a functional confirmation', await page.locator('.enrollment__hint[role="status"]').isVisible());
  await screenshot('confirmed');
  await page.locator('.enrollment__success button').click(); await state('closed'); await page.waitForTimeout(950);
  check('Return restores input focus', await page.locator('#creature-context').evaluate(el => document.activeElement === el));
  const restored = await page.locator('.whisper').boundingBox();
  check('Home composition restored', Math.abs(initial.x-restored.x) < 1 && Math.abs(initial.y-restored.y) < 1);
  check('Keyboard viewport override released', await page.locator('main').evaluate(el => !el.style.getPropertyValue('--enrollment-visible-height')));
  await open();
  check('Reopening starts empty', await page.locator('#enrollment-name').inputValue() === '' && await page.locator('#enrollment-phone').inputValue() === '');
  await page.locator('#enrollment-name').fill('Estudiante de Prueba');
  await page.keyboard.press('Escape'); await state('closed');
  await open(); check('Escape discarded the draft', await page.locator('#enrollment-name').inputValue() === '');
  await page.locator('#enrollment-name').fill('Estudiante de Prueba');
  await page.locator('.site-header nav a[href="/features"]').click();
  await page.locator('.features-page').waitFor();
  await page.locator('.site-header nav a[href="/"]').click(); await state('closed');
  await open(); check('Leaving Home discarded the draft', await page.locator('#enrollment-name').inputValue() === '');
  check('Fields never persisted', await page.evaluate(() => !JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]).match(/Estudiante de Prueba|7000-0000/)));
  check('Enrollment and navigation never requested APIs', requests === 0);
  check('No application errors', errors.length === 0);
  await writeFile(`${directory}/${id}.json`, JSON.stringify({id, viewport, checks, screenshots, errors, requests, date:new Date().toISOString()}, null, 2));
  console.log(`${id}: ${checks.length} checks / ${screenshots.length} screenshots`);
} finally { await browser.close(); }
