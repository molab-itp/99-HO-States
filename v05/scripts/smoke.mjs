#!/usr/bin/env node
// Headless smoke test for the v05 React app: boots the Vite dev server in-process, drives it
// with Playwright/Chromium through the main flows, and screenshots each step. Run with
// `npm run smoke`. Exits non-zero (and prints them) if the page logs any console errors.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const screenshotDir = path.join(rootDir, 'playwright', 'screenshots');
const PORT = 5183;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(text, expected, message) {
  if (!text || !text.includes(expected)) {
    throw new Error(`${message}: got ${JSON.stringify(text)}`);
  }
}

async function main() {
  const server = await createServer({ root: rootDir, server: { port: PORT, strictPort: true } });
  await server.listen();
  const url = `http://localhost:${PORT}/`;
  console.log(`Dev server up at ${url}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) consoleErrors.push(`HTTP ${res.status()} for ${res.url()}`);
  });

  let step = 0;
  async function shot(name) {
    step += 1;
    const file = `${String(step).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(screenshotDir, file) });
    console.log(`  screenshot: ${file}`);
  }

  try {
    console.log('Home screen...');
    await page.goto(url);
    await page.waitForSelector('text=USnA Heads');
    await shot('home');

    console.log('List of Heads...');
    await page.click('text=List of Heads');
    await page.waitForSelector('.president-list');
    const firstRowName = await page.locator('.president-row .name').first().textContent();
    assertIncludes(firstRowName, '#01', 'first list row should show its number');
    await shot('list');

    console.log('Open a detail row...');
    await page.locator('.president-row').first().click();
    await page.waitForSelector('.detail-text h1');
    await shot('detail-before-reveal');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-revealed');

    console.log('Next / Previous / Random toolbar...');
    await page.click('button[aria-label="Next"]');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-next');
    await page.click('button[aria-label="Previous"]');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-previous');
    await page.click('button[aria-label="Random"]');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-random');

    console.log('Draw on Photo: draw a stroke, Done saves it over the portrait...');
    assert(!(await page.isVisible('button[aria-label="Hide Drawing"]')), 'no hide/show button before a drawing exists');
    await page.click('button[aria-label="Draw on Photo"]');
    await page.waitForSelector('.drawing-surface');
    const box = await page.locator('.drawing-surface').boundingBox();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(box.x + box.width * (0.2 + i * 0.06), box.y + box.height * (0.3 + i * 0.03));
    }
    await page.mouse.up();
    assert((await page.locator('.drawing-surface path').count()) === 1, 'editor should show the new stroke');
    await shot('drawing-editor');
    await page.click('button:has-text("Done")');
    await page.waitForSelector('.drawing-overlay path');
    await shot('detail-with-drawing');

    console.log('Hide / Show drawing, and it survives a reload...');
    await page.click('button[aria-label="Hide Drawing"]');
    await page.waitForSelector('.drawing-overlay', { state: 'detached' });
    await page.click('button[aria-label="Show Drawing"]');
    await page.waitForSelector('.drawing-overlay path');
    const drawnTitle = (await page.locator('.nav-title-mono').textContent()).split(' ')[0];
    await page.reload();
    await page.click('text=List of Heads');
    await page.locator('.president-row .name', { hasText: drawnTitle }).click();
    await page.waitForSelector('.drawing-overlay path');

    console.log('Clear + Done deletes the drawing...');
    await page.click('button[aria-label="Draw on Photo"]');
    await page.waitForSelector('.drawing-surface path');
    await page.click('button[aria-label="Clear"]');
    await page.click('button:has-text("Done")');
    await page.waitForSelector('.drawing-overlay', { state: 'detached' });
    assert(!(await page.isVisible('button[aria-label="Hide Drawing"]')), 'hide/show button should go away with the drawing');

    console.log('Back to List (this detail was pushed from the list row)...');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('.president-list');
    await shot('back-to-list');

    console.log('Back to Home...');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('text=Random Head');
    await shot('back-home');

    console.log('Random Head from Home...');
    await page.click('text=Random Head');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('home-random');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');

    console.log('Slide Interval / Fadein Delay pickers persist and drive the detail screen...');
    await page.click('.segmented[aria-label="Slide Interval"] >> text=10s');
    const delayLabels = await page.locator('.segmented[aria-label="Fadein Delay"] .segment').allTextContents();
    assert(delayLabels.join(',') === '1.0s,2.0s,5.0s', `delay labels should scale with a 10s interval: got ${delayLabels}`);
    await page.click('.segmented[aria-label="Fadein Delay"] >> text=1.0s');
    await page.reload();
    await page.waitForSelector('button:has-text("Start Slideshow")');
    assert(
      (await page.locator('.segmented[aria-label="Slide Interval"] .segment.selected').textContent()) === '10s',
      'Slide Interval should survive a reload',
    );
    assert(
      (await page.locator('.segmented[aria-label="Fadein Delay"] .segment.selected').textContent()) === '1.0s',
      'Fadein Delay should survive a reload',
    );
    await shot('home-slideshow-settings');
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('.nav-title-mono', { timeout: 4000 });
    const tenSecTitle = await page.locator('.nav-title-mono').textContent();
    const tenSecRemaining = parseFloat(tenSecTitle.split('· ')[1]);
    assert(tenSecRemaining > 5, `10s interval countdown should start above 5s: got ${JSON.stringify(tenSecTitle)}`);
    // Fadein Delay of 1.0s: details show well before the old fixed 2s reveal.
    await page.waitForSelector('.detail-text.visible', { timeout: 1600 });
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    // Back to the defaults so the natural-tick test below waits out 5s, not 10s.
    await page.click('.segmented[aria-label="Slide Interval"] >> text=5s');
    await page.click('.segmented[aria-label="Fadein Delay"] >> text=2.5s');

    // `slideIndex` (which president a sequential slideshow resumes at) persists across the whole
    // session — earlier steps above (list row, Next/Previous/Random, Random Head) already moved
    // it around — so reset first to get a deterministic #01 start for this section.
    console.log('Reset Visit Count (clean slate before the sequential slideshow test)...');
    await page.click('text=Reset Visit Count');
    await page.waitForTimeout(100);

    // Starting the slideshow immediately navigates to a detail screen (same as the SwiftUI app:
    // the pushed detail view covers Home), so "Stop Slideshow" isn't reachable until you leave.
    // Sequential (Random Mode off) starts from `slideIndex`, #01 right after the reset above.
    // While it runs, the center toolbar button is Pause/Play (not Random) and never exits the
    // slideshow; Next/Previous keep paging instead of stopping it.
    console.log('Sequential slideshow start (Random Mode off)...');
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('.nav-title-mono', { timeout: 4000 });
    const runningTitle = await page.locator('.nav-title-mono').textContent();
    assertIncludes(runningTitle, '·', 'slideshow-active title should show a countdown');
    assertIncludes(runningTitle, '#01', 'sequential slideshow should start from the first president after a reset');
    await shot('slideshow-running');

    // Regression check for a real bug: the auto-advance previously fired via a `setRemainingTenths`
    // updater that also called `setNav(...)` as a side effect. React 18 StrictMode intentionally
    // double-invokes functional state updaters to catch exactly that impurity, so the advance fired
    // twice per natural tick (#01 -> #03, not #01 -> #02). A manual button click doesn't exercise
    // this path — only waiting out a real ~5s tick does.
    console.log('Waiting out one natural ~5s tick (must advance by exactly 1, not 2)...');
    await page.waitForFunction(
      () => document.querySelector('.nav-title-mono')?.textContent?.startsWith('#02'),
      { timeout: 6000 },
    );
    await page.waitForTimeout(150);
    const autoAdvancedTitle = await page.locator('.nav-title-mono').textContent();
    assertIncludes(autoAdvancedTitle, '#02', 'one natural slideshow tick should advance by exactly 1 president');

    console.log('Next during slideshow (should advance, not stop it)...');
    await page.click('button[aria-label="Next"]');
    await page.waitForTimeout(200);
    const afterNextTitle = await page.locator('.nav-title-mono').textContent();
    assertIncludes(afterNextTitle, '·', 'slideshow should still be active after Next');
    assertIncludes(afterNextTitle, '#03', 'sequential Next should move to the next president');

    console.log('Pause / Play toggle...');
    await page.click('button[aria-label="Pause"]');
    await page.waitForSelector('button[aria-label="Play"]');
    await shot('slideshow-paused');
    await page.click('button[aria-label="Play"]');
    await page.waitForSelector('button[aria-label="Pause"]');

    console.log('Back stops the sequential slideshow at #03...');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');

    console.log('Restarting the sequential slideshow should resume at #03, not restart at #01...');
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('.nav-title-mono', { timeout: 4000 });
    const resumedTitle = await page.locator('.nav-title-mono').textContent();
    assertIncludes(resumedTitle, '#03', 'sequential slideshow should resume where it left off, not restart at #01');
    await shot('slideshow-resumed');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');

    console.log('Random Mode slideshow...');
    await page.click('text=Random Mode');
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('.nav-title-mono', { timeout: 4000 });
    await shot('slideshow-random-running');
    await page.click('button[aria-label="Next"]');
    await page.waitForTimeout(200);
    await page.click('button[aria-label="Previous"]');
    await page.waitForTimeout(200);
    const randomStillActive = await page.locator('.nav-title-mono').textContent();
    assertIncludes(randomStillActive, '·', 'random-mode slideshow should still be active after Next/Previous');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');

    console.log('Reset Visit Count...');
    const before = await page.locator('.visited-count').textContent();
    await page.click('text=Reset Visit Count');
    await page.waitForFunction(
      (prev) => document.querySelector('.visited-count')?.textContent !== prev,
      before,
    );
    const after = await page.locator('.visited-count').textContent();
    console.log(`  "${before}" -> "${after}"`);
    await shot('after-reset');
  } finally {
    await browser.close();
    await server.close();
  }

  if (consoleErrors.length > 0) {
    console.error('\nConsole errors detected:');
    for (const e of consoleErrors) console.error(' -', e);
    process.exitCode = 1;
    return;
  }
  console.log('\nNo console errors. Smoke test passed.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
