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
    // Helpers for the Settings sheet (v2's SettingsView), opened from the detail screen's info
    // button. Picking a president or starting the slideshow dismisses it.
    async function openSettings() {
      await page.click('button[aria-label="Settings"]');
      await page.waitForSelector('button:has-text("Start Slideshow")');
    }
    async function closeSettings() {
      await page.click('.settings-sheet button:has-text("Done")');
      await page.waitForSelector('.settings-sheet', { state: 'detached' });
    }
    async function pickFromList(orderText) {
      await openSettings();
      await page.click('text=List of Heads');
      await page.waitForSelector('.president-list');
      await page.locator('.president-row .name', { hasText: orderText }).click();
      await page.waitForSelector('.settings-sheet', { state: 'detached' });
    }
    async function title() {
      return page.locator('.nav-title-mono').textContent();
    }

    console.log('App opens on the detail screen, paused...');
    await page.goto(url);
    await page.waitForSelector('.detail-text h1');
    await page.waitForSelector('button[aria-label="Play"]');
    assert(!(await title()).includes('·'), 'paused detail title should not show a countdown');
    assert(!(await page.isVisible('button[aria-label="Back"]')), 'start screen has no back button');
    await shot('detail-start');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });

    console.log('Settings sheet -> List of Heads -> pick #01...');
    await openSettings();
    await page.waitForSelector('text=USnA Heads');
    await shot('settings');
    await page.click('text=List of Heads');
    await page.waitForSelector('.president-list');
    const firstRowName = await page.locator('.president-row .name').first().textContent();
    assertIncludes(firstRowName, '#01', 'first list row should show its number');
    await shot('list');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    await page.click('text=List of Heads');
    await page.locator('.president-row').first().click();
    await page.waitForSelector('.settings-sheet', { state: 'detached' });
    assertIncludes(await title(), '#01', 'picking a list row should show it');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-revealed');

    console.log('Next / Previous wrap while paused...');
    await page.click('button[aria-label="Previous"]');
    await page.waitForTimeout(100);
    assert(!(await title()).startsWith('#01'), 'Previous from #01 should wrap to the last president');
    await page.click('button[aria-label="Next"]');
    await page.waitForTimeout(100);
    assertIncludes(await title(), '#01', 'Previous then Next should return to #01');
    await page.click('button[aria-label="Next"]');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    assertIncludes(await title(), '#02', 'Next should move to #02');
    await shot('detail-next');

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

    console.log('Hide / Show drawing, and it survives a reload (which resumes at the same president)...');
    await page.click('button[aria-label="Hide Drawing"]');
    await page.waitForSelector('.drawing-overlay', { state: 'detached' });
    await page.click('button[aria-label="Show Drawing"]');
    await page.waitForSelector('.drawing-overlay path');
    const drawnTitle = (await title()).split(' ')[0];
    await page.reload();
    await page.waitForSelector('.drawing-overlay path');
    assertIncludes(await title(), drawnTitle, 'reload should resume at the last-shown president');

    console.log('Clear + Done deletes the drawing...');
    await page.click('button[aria-label="Draw on Photo"]');
    await page.waitForSelector('.drawing-surface path');
    await page.click('button[aria-label="Clear"]');
    await page.click('button:has-text("Done")');
    await page.waitForSelector('.drawing-overlay', { state: 'detached' });
    assert(!(await page.isVisible('button[aria-label="Hide Drawing"]')), 'hide/show button should go away with the drawing');

    console.log('Reactions: added in the drawing editor, shown along the photo bottom, pinned while zoomed...');
    assert((await page.locator('.detail-text button[aria-label="Add Reaction"]').count()) === 0, 'reaction controls should not be in the summary text');
    await page.click('button[aria-label="Draw on Photo"]');
    await page.waitForSelector('.drawing-surface');
    for (let i = 0; i < 2; i++) {
      await page.click('button[aria-label="Add Reaction"]');
      await page.click('.reaction-picker-option >> nth=0');
    }
    assert((await page.locator('.drawing-editor .reaction-overlay').textContent()) === '👍🏾 👍🏾', 'editor overlay should show both reactions');
    await shot('drawing-editor-reactions');
    await page.click('button:has-text("Done")');
    const overlay = page.locator('.zoomable-image:not([aria-hidden]) .reaction-overlay span').last();
    await overlay.waitFor();
    const frame = await page.locator('.zoomable-image').last().boundingBox();
    const reactionsBefore = await overlay.boundingBox();
    assert(frame.y + frame.height - (reactionsBefore.y + reactionsBefore.height) < 20, 'reactions should sit at the bottom edge of the photo');
    await page.click('button[aria-label="Zoom In"]');
    await page.click('button[aria-label="Zoom In"]');
    await page.waitForTimeout(300);
    const reactionsAfter = await overlay.boundingBox();
    assert(Math.abs(reactionsAfter.y - reactionsBefore.y) < 1 && Math.abs(reactionsAfter.height - reactionsBefore.height) < 1, 'reactions should not move or scale with zoom');
    await shot('detail-reactions-zoomed');
    await page.click('button[aria-label="Reset Zoom"]');
    await page.click('button[aria-label="Draw on Photo"]');
    await page.click('button[aria-label="Remove Reaction"]');
    await page.click('button[aria-label="Remove Reaction"]');
    assert(await page.isDisabled('button[aria-label="Remove Reaction"]'), '- should disable once no reactions are left');
    await page.click('button:has-text("Done")');
    await page.waitForSelector('.reaction-overlay', { state: 'detached' });

    console.log('Random Head from Settings...');
    await openSettings();
    await page.click('text=Random Head');
    await page.waitForSelector('.settings-sheet', { state: 'detached' });
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('settings-random');

    console.log('Slide Interval / Fadein Delay pickers persist and drive the detail screen...');
    await openSettings();
    await page.click('.segmented[aria-label="Slide Interval"] >> text=10s');
    const delayLabels = await page.locator('.segmented[aria-label="Fadein Delay"] .segment').allTextContents();
    assert(delayLabels.join(',') === '1.0s,2.0s,4.0s,5.0s', `delay labels should scale with a 10s interval: got ${delayLabels}`);
    await page.click('.segmented[aria-label="Fadein Delay"] >> text=1.0s');
    await page.reload();
    await page.waitForSelector('.detail-text h1');
    await openSettings();
    assert(
      (await page.locator('.segmented[aria-label="Slide Interval"] .segment.selected').textContent()) === '10s',
      'Slide Interval should survive a reload',
    );
    assert(
      (await page.locator('.segmented[aria-label="Fadein Delay"] .segment.selected').textContent()) === '1.0s',
      'Fadein Delay should survive a reload',
    );
    await shot('settings-slideshow-settings');
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('.settings-sheet', { state: 'detached' });
    await page.waitForSelector('button[aria-label="Pause"]');
    const tenSecRemaining = parseFloat((await title()).split('· ')[1]);
    assert(tenSecRemaining > 5, `10s interval countdown should start above 5s: got ${tenSecRemaining}`);

    console.log('Settings sheet holds the countdown...');
    await openSettings();
    await page.waitForTimeout(600);
    await closeSettings();
    const heldRemaining = parseFloat((await title()).split('· ')[1]);
    assert(heldRemaining > 9, `countdown should not run behind Settings: got ${heldRemaining}`);
    await page.click('button[aria-label="Pause"]');
    await page.waitForSelector('button[aria-label="Play"]');

    // Back to the defaults so the natural-tick test below waits out 5s, not 10s.
    await openSettings();
    await page.click('.segmented[aria-label="Slide Interval"] >> text=5s');
    await page.click('.segmented[aria-label="Fadein Delay"] >> text=2.0s');

    console.log('Fade Period picker persists...');
    const fadeLabels = await page.locator('.segmented[aria-label="Fade Period"] .segment').allTextContents();
    assert(fadeLabels.join(',') === '0.1s,1s,2s', `fade period labels: got ${fadeLabels}`);
    assert(
      (await page.locator('.segmented[aria-label="Fade Period"] .segment.selected').textContent()) === '1s',
      'Fade Period should default to 1s',
    );
    await page.click('.segmented[aria-label="Fade Period"] >> text="2s"');
    await page.reload();
    await page.waitForSelector('.detail-text h1');
    await openSettings();
    assert(
      (await page.locator('.segmented[aria-label="Fade Period"] .segment.selected').textContent()) === '2s',
      'Fade Period should survive a reload',
    );
    // Back to the 1s default for the cross-fade check below.
    await page.click('.segmented[aria-label="Fade Period"] >> text="1s"');
    await closeSettings();

    // Sequential (Random Mode off) plays on from whatever is shown, so pick #01 first.
    console.log('Sequential slideshow (Random Mode off) from #01...');
    await pickFromList('#01');
    await openSettings();
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('button[aria-label="Pause"]');
    const runningTitle = await title();
    assertIncludes(runningTitle, '·', 'playing title should show a countdown');
    assertIncludes(runningTitle, '#01', 'sequential slideshow should start from the shown president');
    assert((await page.locator('.zoom-controls').count()) === 0, 'zoom controls should be hidden while playing');
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
    assertIncludes(await title(), '#02', 'one natural slideshow tick should advance by exactly 1 president');

    console.log('Next while playing (should advance and keep playing)...');
    await page.click('button[aria-label="Next"]');
    await page.waitForTimeout(200);
    const afterNextTitle = await title();
    assertIncludes(afterNextTitle, '·', 'slideshow should still be playing after Next');
    assertIncludes(afterNextTitle, '#03', 'sequential Next should move to the next president');

    console.log('Advance while playing cross-fades the header image over the 1s Fade Period...');
    assert((await page.locator('.fade-layer.fade-out').count()) === 1, 'outgoing image should be fading out');
    assert((await page.locator('.fade-layer.fade-in').count()) === 1, 'incoming image should be fading in');
    await shot('slideshow-cross-fade');
    await page.waitForSelector('.fade-layer.fade-out', { state: 'detached', timeout: 1500 });

    console.log('Pause / Play toggle...');
    await page.click('button[aria-label="Pause"]');
    await page.waitForSelector('button[aria-label="Play"]');
    assert(!(await title()).includes('·'), 'paused title should hide the countdown');
    await shot('slideshow-paused');
    await page.click('button[aria-label="Play"]');
    await page.waitForSelector('button[aria-label="Pause"]');
    await page.click('button[aria-label="Pause"]');

    console.log('Random Mode slideshow...');
    await openSettings();
    await page.click('text=Random Mode');
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('button[aria-label="Pause"]');
    assert(await page.isDisabled('button[aria-label="Previous"]'), 'Previous is disabled at the start of a random walk');
    await shot('slideshow-random-running');
    await page.click('button[aria-label="Next"]');
    await page.waitForTimeout(200);
    await page.click('button[aria-label="Previous"]');
    await page.waitForTimeout(200);
    assertIncludes(await title(), '·', 'random-mode slideshow should still be playing after Next/Previous');
    await page.click('button[aria-label="Pause"]');
    await openSettings();
    await page.click('text=Random Mode');
    await page.reload();
    await page.waitForSelector('.detail-text h1');

    console.log('Reset Visit Count...');
    await openSettings();
    const before = await page.locator('.visited-count').textContent();
    await page.click('text=Reset Visit Count');
    await page.waitForFunction(
      (prev) => document.querySelector('.visited-count')?.textContent !== prev,
      before,
    );
    const after = await page.locator('.visited-count').textContent();
    console.log(`  "${before}" -> "${after}"`);
    await shot('after-reset');

    console.log('Zoom controls on a touch phone (no hover, coarse pointer): shown while paused...');
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const phonePage = await phone.newPage();
    phonePage.on('pageerror', (err) => consoleErrors.push(String(err)));
    await phonePage.goto(url);
    await phonePage.waitForSelector('.zoom-controls');
    assert(await phonePage.isVisible('button[aria-label="Zoom In"]'), 'zoom controls should show on a touch screen');
    await phonePage.tap('button[aria-label="Zoom In"]');
    await phonePage.waitForSelector('.zoomable-image.zoomed');
    await phonePage.tap('button[aria-label="Reset Zoom"]');
    await phonePage.waitForSelector('.zoomable-image.zoomed', { state: 'detached' });
    await phonePage.tap('button[aria-label="Play"]');
    await phonePage.waitForSelector('.zoom-controls', { state: 'detached' });
    await phonePage.tap('button[aria-label="Pause"]');
    await phonePage.waitForSelector('.zoom-controls');
    await phone.close();
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
