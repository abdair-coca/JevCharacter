import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const [route = 'home', size = 'desktop', theme = 'light', language = 'es', mode = 'motion'] = process.argv.slice(2);
const viewport = size === 'desktop' ? { width: 1440, height: 900 } : size === 'short' ? { width: 390, height: 420 } : size === 'narrow' ? { width: 320, height: 568 } : { width: 390, height: 844 };
const id = [route, size, theme, language, mode].join('-');
const directory = fileURLToPath(new URL('./', import.meta.url));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference', isMobile: size !== 'desktop', hasTouch: size !== 'desktop' });
await context.addInitScript(({ theme, language }) => {
  localStorage.setItem('jevling.theme', JSON.stringify(theme)); localStorage.setItem('jevling.language', JSON.stringify(language));
}, { theme, language });
const page = await context.newPage();
page.setDefaultTimeout(45000);
const errors = []; const checks = []; const shots = []; let apiCalls = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('503')) errors.push(message.text()); });
await page.route('**/api/**', async request => { apiCalls++; await request.fulfill({ status: 503, contentType: 'application/json', body: '{"unavailable":true}' }); });
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log(`PASS ${name}`); };
const shot = async name => { const filename = `${id}-${name}.png`; await page.screenshot({ path: `${directory}/${filename}` }); shots.push(filename); };
const jump = async (selector, index) => {
  await page.locator(`[${selector}="${index}"]`).evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - document.querySelector('.site-header').getBoundingClientRect().bottom - 16, behavior: 'instant' }));
  await page.waitForTimeout(1400);
};
const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
try {
  await page.goto(`http://127.0.0.1:4175/${route === 'home' ? '' : route === 'story' ? 'about' : 'features'}`);
  await page.locator('.character-rive[data-ready="true"]').waitFor({ state: 'attached' });
  await page.waitForTimeout(mode === 'reduced' ? 3400 : 1800);
  check('Requested theme and language applied', await page.evaluate(({theme, language}) => document.documentElement.dataset.theme === theme && document.documentElement.lang === language, {theme, language}));
  check('No horizontal overflow', await overflow());
  check('One Rive canvas', await page.locator('.character-rive canvas').count() === 1);
  if (route === 'home') {
    check('Single-screen Home', await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
    check('No decorative miniatures or helper copy', await page.locator('.whisper__presence, .brain-hud__presence, #context-help, .intro-copy p, .home-footer > span, .organic-light').count() === 0);
    const input = await page.locator('.whisper').boundingBox();
    check('Compact input', input.height <= 60);
    const button = page.locator('.brain-hud__summary');
    check('Compact HUD', (await button.boundingBox()).height <= 50);
    await shot('rest');
    await button.click();
    const panel = await page.locator('#brain-details').boundingBox();
    check('HUD opens above the summary within viewport', panel.y >= 0 && panel.y + panel.height <= (await button.boundingBox()).y + 1);
    check('Input stays in place', Math.abs((await page.locator('.whisper').boundingBox()).y - input.y) < 1);
    await shot('hud');
    await page.keyboard.press('Escape');
    await page.locator('#creature-context').fill('Hola Jev');
    check('Input is labelled and usable', await page.getByRole('textbox').inputValue() === 'Hola Jev');
  } else if (route === 'features') {
    check('Eight semantic chapters', await page.locator('[data-chapter-card]').count() === 8);
    check('Slideshow UI and details removed', await page.locator('.showcase-navigation, .showcase-progress, .showcase-chapter__index, details').count() === 0);
    const isStatic = await page.locator('main').getAttribute('data-static') === 'true';
    if (isStatic) {
      check('Static descriptions for all chapters', await page.locator('.showcase-static-steps').count() === 8);
      await shot('static');
    } else {
      await jump('data-chapter-card', 0);
      await shot('perceives');
      if (size !== 'desktop') {
        const art = await page.locator('.showcase-flight').boundingBox();
        const copy = await page.locator('[data-chapter-card="0"] .showcase-chapter__copy').boundingBox();
        check('Mobile creature above the text', art.y + art.height < copy.y);
      }
      const anchor = await page.evaluate(() => scrollY);
      const flightSamples = await page.evaluate(() => new Promise(resolve => {
        const node = document.querySelector('.showcase-flight');
        window.scrollBy({top: 120, behavior: 'instant'});
        requestAnimationFrame(() => {
          const early = getComputedStyle(node).transform;
          setTimeout(() => resolve([early, getComputedStyle(node).transform]), 1200);
        });
      }));
      check('Flight settles after scrolling stops', flightSamples[0] !== flightSamples[1]);
      await page.locator('[data-chapter-card="0"] button').click();
      await page.waitForTimeout(50);
      check('View scene does not jump instantly', await page.evaluate(() => scrollY) > anchor + 2);
      await page.waitForTimeout(1500);
      check('View scene arrives at its anchor', Math.abs(await page.evaluate(() => scrollY) - anchor) < 2);
      check('View scene remains keyboard-focusable', await page.locator('[data-chapter-card="0"] button').evaluate(el => el === document.activeElement));
      await jump('data-chapter-card', 2);
      check('Scroll selects Decide', await page.locator('main').getAttribute('data-chapter') === 'decides');
      await shot('decides');
      for (const index of [4, 5, 7]) {
        await jump('data-chapter-card', index);
        check(`Chapter ${index} stays within width`, await overflow());
      }
    }
    check('Features does not call APIs', apiCalls === 0);
  } else {
    check('Five semantic story sections', await page.locator('[data-story-scene]').count() === 5);
    check('Story slideshow and details removed', await page.locator('.story-navigation, .story-progress, details').count() === 0);
    const isStatic = await page.locator('main').getAttribute('data-static') === 'true';
    if (isStatic) {
      check('Static images are available', await page.locator('.story-static-media img').count() === 3);
      check('Particles paused', await page.locator('.story-particles').getAttribute('data-running') === 'false');
      await shot('static');
      await page.locator('.story-stage').scrollIntoViewIfNeeded();
      await page.locator('.character-rive[data-static-preparing="false"]').waitFor();
      check('Static Jev prepares when its final section is visible', await page.locator('.story-page').getAttribute('data-story-status') === 'ready');
      await shot('static-jev');
    } else {
      await page.waitForFunction(() => document.querySelector('.story-particles')?.dataset.prepared === 'true');
      await jump('data-story-scene', 1);
      await shot('bob');
      if (size !== 'desktop') {
        const art = await page.locator('.story-flight').boundingBox();
        const copy = await page.locator('#story-bob .story-copy').boundingBox();
        check('Mobile particles above the text', art.y + art.height < copy.y);
      } else {
        const art = await page.locator('.story-art').boundingBox();
        await page.mouse.move(art.x + art.width * .5, art.y + art.height * .35);
        await page.waitForTimeout(600);
        check('Pointer deforms the shape', Number(await page.locator('.story-particles').getAttribute('data-deformation')) > .01);
        await shot('pointer');
        await page.mouse.move(2, 2); await page.waitForTimeout(1800);
        check('Shape returns after pointer leaves', Number(await page.locator('.story-particles').getAttribute('data-deformation')) < .001);
      }
      await jump('data-story-scene', 4);
      await shot('star');
      await page.locator('.story-reveal-cue button').click();
      await page.waitForTimeout(80);
      const early = Number(await page.locator('main').getAttribute('data-story-progress'));
      check('Reveal traverses intermediate progress', early < 4.9);
      await page.waitForTimeout(3000);
      check('Reveal finishes through scroll', Number(await page.locator('.story-particles').getAttribute('data-reveal')) > .95);
      await shot('revealed');
      await jump('data-story-scene', 4);
      check('Reverse scroll reforms the star', Number(await page.locator('.story-particles').getAttribute('data-reveal')) < .01);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(500);
      check('Particles pause offscreen', await page.locator('.story-particles').getAttribute('data-running') === 'false');
      await jump('data-story-scene', 1);
      check('Particles resume on return', await page.locator('.story-particles').getAttribute('data-running') === 'true');
    }
    check('Story does not call APIs', apiCalls === 0);
  }
  check('No application errors', errors.length === 0);
  await writeFile(`${directory}/${id}.json`, JSON.stringify({ id, viewport, checks, shots, errors, apiCalls, date: new Date().toISOString() }, null, 2));
  console.log(`${id}: ${checks.length} checks, ${shots.length} screenshots`);
} finally { await browser.close(); }
