#!/usr/bin/env node
// Headless smoke test for the v4 React app: boots the Vite dev server in-process, drives it
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
    await page.waitForSelector('text=US Presidents');
    await shot('home');

    console.log('List of Presidents...');
    await page.click('text=List of Presidents');
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
    await page.click('button:has-text("Next")');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-next');
    await page.click('button:has-text("Previous")');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-previous');
    await page.click('button:has-text("Random")');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-random');

    console.log('Back to List (this detail was pushed from the list row)...');
    await page.click('text=Back');
    await page.waitForSelector('.president-list');
    await shot('back-to-list');

    console.log('Back to Home...');
    await page.click('text=Back');
    await page.waitForSelector('text=Random President');
    await shot('back-home');

    console.log('Random President from Home...');
    await page.click('text=Random President');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('home-random');
    await page.click('text=Back');
    await page.waitForSelector('button:has-text("Start Slideshow")');

    // Starting the slideshow immediately navigates to a random president's detail screen (same
    // as the SwiftUI app: the pushed detail view covers Home), so "Stop Slideshow" isn't
    // reachable until you're back on Home. While it runs, the nav title shows a countdown and
    // any toolbar button (Previous/Random/Next) just stops it in place instead of navigating.
    console.log('Slideshow start (navigates straight to a detail screen)...');
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('.nav-title-mono', { timeout: 4000 });
    const runningTitle = await page.locator('.nav-title-mono').textContent();
    assertIncludes(runningTitle, '·', 'slideshow-active title should show a countdown');
    await shot('slideshow-running');

    console.log('Stopping the slideshow via a toolbar button...');
    await page.click('button:has-text("Random")');
    await page.waitForTimeout(200);
    const stoppedTitle = await page.locator('.nav-title-mono').textContent();
    if (stoppedTitle.includes('·')) {
      throw new Error(`expected slideshow to stop (title without countdown), got "${stoppedTitle}"`);
    }
    await shot('slideshow-stopped');

    await page.click('text=Back');
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
