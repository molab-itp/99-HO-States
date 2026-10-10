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

  // Stand-ins for the browser's speech and translation, which a headless browser can't be relied
  // on to have: speech "plays" for `window.__speech.durationMs` and is recorded in
  // `window.__speech.spoken`; translation just tags the text with its target language.
  await page.addInitScript(() => {
    const state = { spoken: [], durationMs: 300 };
    window.__speech = state;
    let current = null;
    let timer = null;
    // Ends `utterance` if it is still the one playing (a cancelled one may already be replaced).
    const finish = (utterance) => {
      if (current === utterance) current = null;
      utterance?.onend?.({});
    };
    const voices = ['en-US', 'en-GB', 'zh-CN', 'es-ES', 'fr-FR', 'cy-GB'].map((lang) => ({ lang, name: lang }));
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => voices,
        addEventListener() {},
        removeEventListener() {},
        speak(utterance) {
          state.spoken.push({ text: utterance.text, lang: utterance.lang });
          current = utterance;
          timer = setTimeout(finish, state.durationMs, utterance);
        },
        cancel() {
          clearTimeout(timer);
          if (current) setTimeout(finish, 0, current);
        },
        pause() {
          clearTimeout(timer);
        },
        resume() {
          timer = setTimeout(finish, state.durationMs, current);
        },
      },
    });
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    window.Translator = {
      create: async ({ targetLanguage }) => ({ translate: async (text) => `[${targetLanguage}] ${text}` }),
    };
  });

  let step = 0;
  async function shot(name) {
    step += 1;
    const file = `${String(step).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(screenshotDir, file) });
    console.log(`  screenshot: ${file}`);
  }

  try {
    // Helpers for moving between Landing (v2's LandingView, the root screen) and the detail
    // screen shown on top of it.
    async function backToLanding() {
      await page.click('button[aria-label="Back"]');
      await page.waitForSelector('button:has-text("Start Slideshow")');
    }
    async function resume() {
      await page.click('button:has-text("Resume")');
      await page.waitForSelector('.detail-text h1');
    }
    // From Landing: List of Heads -> the row whose name includes `orderText`.
    async function pickFromList(orderText) {
      await page.click('text=List of Heads');
      await page.waitForSelector('.hos-list');
      await page.locator('.hos-row .name', { hasText: orderText }).click();
      await page.waitForSelector('.detail-text h1');
    }
    async function title() {
      return page.locator('.nav-title-mono').textContent();
    }

    console.log('App opens on Landing...');
    await page.goto(url);
    await page.waitForSelector('button:has-text("Resume")');
    await page.waitForSelector('text=USnA Heads');
    assert(!(await page.isVisible('button[aria-label="Back"]')), 'Landing is the root screen: no back button');
    const linkTitles = await page.locator('a.source-link').allTextContents();
    assert(linkTitles.length === 2, `Landing should list the links.json links: got ${linkTitles.length}`);
    assertIncludes(linkTitles[0], 'Data Source: Wikipedia', 'links should keep links.json order');
    assert(!linkTitles.some((t) => t.includes('Web App')), 'the web app should not link to itself');
    await shot('landing');

    console.log('Resume -> detail screen, paused...');
    await resume();
    await page.waitForSelector('button[aria-label="Play"]');
    assert(!(await title()).includes('·'), 'paused detail title should not show a countdown');
    assert(await page.isVisible('button[aria-label="Back"]'), 'detail screen should have a back button');
    await shot('detail-start');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });

    console.log('Back -> List of Heads -> pick #01...');
    await backToLanding();
    await page.click('text=List of Heads');
    await page.waitForSelector('.hos-list');
    const firstRowName = await page.locator('.hos-row .name').first().textContent();
    assertIncludes(firstRowName, '#01', 'first list row should show its number');
    await shot('list');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    await pickFromList('#01');
    assertIncludes(await title(), '#01', 'picking a list row should show it');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('detail-revealed');

    console.log('Next / Previous wrap while paused...');
    await page.click('button[aria-label="Previous"]');
    await page.waitForTimeout(100);
    assert(!(await title()).startsWith('#01'), 'Previous from #01 should wrap to the last HOS');
    await page.click('button[aria-label="Next"]');
    await page.waitForTimeout(100);
    assertIncludes(await title(), '#01', 'Previous then Next should return to #01');
    await page.click('button[aria-label="Next"]');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    assertIncludes(await title(), '#02', 'Next should move to #02');
    await shot('detail-next');

    console.log('Draw on Photo: draw a stroke, Done saves it over the portrait...');
    assert(!(await page.isVisible('.nav-menu')), 'no photo/drawing menu before a drawing exists');
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

    console.log('Photo / Photo + Drawing / Drawing Only menu, saved per HOS and across a reload...');
    async function pickDisplayMode(label) {
      await page.click('.nav-menu > button');
      await page.waitForSelector('.nav-menu-list');
      await shot(`display-menu-${label.replace(/\W+/g, '-').toLowerCase()}`);
      await page.click(`.nav-menu-item:has-text("${label}")`);
      await page.waitForSelector('.nav-menu-list', { state: 'detached' });
    }
    assert(await page.isVisible('button[aria-label="Photo + Drawing"]'), 'menu should start at Photo + Drawing');
    await pickDisplayMode('Photo');
    await page.waitForSelector('.drawing-overlay', { state: 'detached' });
    assert(await page.isVisible('button[aria-label="Photo"]'), 'menu button should show the Photo mode');
    await pickDisplayMode('Drawing Only');
    await page.waitForSelector('.zoomable-content.drawing-only .drawing-overlay path');
    assert(
      (await page.locator('.detail-image').evaluate((el) => getComputedStyle(el).opacity)) === '0',
      'Drawing Only should hide the photo',
    );
    await shot('detail-drawing-only');
    // Tapping outside closes the menu without changing the mode.
    await page.click('.nav-menu > button');
    await page.waitForSelector('.nav-menu-list');
    await page.mouse.click(10, 400);
    await page.waitForSelector('.nav-menu-list', { state: 'detached' });
    assert(await page.isVisible('button[aria-label="Drawing Only"]'), 'outside tap should keep Drawing Only');
    const drawnTitle = (await title()).split(' ')[0];
    // Another HOS keeps its own (default) mode.
    await page.click('button[aria-label="Next"]');
    await page.waitForTimeout(100);
    assert(!(await page.isVisible('.zoomable-content.drawing-only')), 'next HOS should show its photo');
    await page.click('button[aria-label="Previous"]');
    await page.waitForSelector('.zoomable-content.drawing-only .drawing-overlay path');
    // Let the new slideIndex reach the pagehide save handler before reloading.
    await page.waitForTimeout(100);
    await page.reload();
    await page.waitForSelector('.zoomable-content.drawing-only .drawing-overlay path');
    assertIncludes(await title(), drawnTitle, 'reload should reopen the detail screen at the last-shown HOS');
    await pickDisplayMode('Photo + Drawing');
    await page.waitForSelector('.drawing-overlay path');
    assert(!(await page.isVisible('.zoomable-content.drawing-only')), 'Photo + Drawing shows the photo again');

    console.log('Clear + Done deletes the drawing...');
    await page.click('button[aria-label="Draw on Photo"]');
    await page.waitForSelector('.drawing-surface path');
    await page.click('button[aria-label="Clear"]');
    await page.click('button:has-text("Done")');
    await page.waitForSelector('.drawing-overlay', { state: 'detached' });
    assert(!(await page.isVisible('.nav-menu')), 'photo/drawing menu should go away with the drawing');

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

    console.log('News from Landing: news.json rows, each linking out with its thumbnail...');
    await backToLanding();
    await page.click('button:has-text("News")');
    await page.waitForSelector('.news-list');
    assert((await page.locator('.nav-title').textContent()) === 'News', 'news screen should be titled News');
    const newsRows = page.locator('.news-row');
    assert((await newsRows.count()) === 10, `News should list the news.json entries: got ${await newsRows.count()}`);
    assertIncludes(await newsRows.first().locator('.label').textContent(), 'Ava DuVernay', 'news should keep news.json order');
    assertIncludes(await newsRows.first().locator('.host').textContent(), 'www.filmlinc.org', 'news row should show its host');
    assertIncludes(await newsRows.first().getAttribute('href'), 'https://www.filmlinc.org/', 'news row should link to its url');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img.news-thumb')].length === 10 &&
      [...document.querySelectorAll('img.news-thumb')].every((img) => img.complete && img.naturalWidth > 0),
    );
    await shot('news');
    await page.reload();
    await page.waitForSelector('.news-list');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    await resume();

    console.log('Credits from Landing: three sections, hidden until their header is tapped...');
    await backToLanding();
    await page.click('button:has-text("Credits")');
    await page.waitForSelector('.credits');
    assert((await page.locator('.nav-title').textContent()) === 'Credits', 'credits screen should be titled Credits');
    const sectionTitles = await page.locator('.credits-header').allTextContents();
    assert(sectionTitles.join(',') === 'Articles,Photos,News', `credits sections: got ${sectionTitles}`);
    assert((await page.locator('.credit-row').count()) === 0, 'credits sections should start hidden');
    // Each section in turn: show it, check its rows and first caption link, then hide it again.
    async function checkSection(name, rowCount, firstTitle, firstHref) {
      const section = page.locator('.credits-section', { has: page.locator(`.credits-header:has-text("${name}")`) });
      await section.locator('.credits-header').click();
      const rows = section.locator('.credit-row');
      assert((await rows.count()) === rowCount, `${name} should list ${rowCount} credits: got ${await rows.count()}`);
      assertIncludes(await rows.first().locator('.title').textContent(), firstTitle, `${name} first title`);
      assertIncludes(await rows.first().locator('.caption').getAttribute('href'), firstHref, `${name} caption should link to its source`);
      assert(await section.locator('.credits-footer').isVisible(), `${name} footer should show with its rows`);
      if (name === 'Photos') await shot('credits-photos');
      await section.locator('.credits-header').click();
      assert((await rows.count()) === 0, `${name} should hide again`);
    }
    await checkSection('Articles', 47, '1. George Washington', 'https://en.wikipedia.org/wiki/George_Washington');
    await checkSection('Photos', 47, '1. George Washington', 'https://commons.wikimedia.org/wiki/File:');
    await checkSection('News', 10, 'Ava DuVernay', 'https://www.filmlinc.org/');
    await page.reload();
    await page.waitForSelector('.credits');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    await resume();

    console.log('Speak from Landing: languages in groups, sample text plays, Auto Speak persists...');
    const lastSpoken = () => page.evaluate(() => window.__speech.spoken.at(-1));
    const spokenCount = () => page.evaluate(() => window.__speech.spoken.length);
    const setSpeechDuration = (ms) => page.evaluate((value) => { window.__speech.durationMs = value; }, ms);
    async function showSpeak() {
      await page.click('button:has-text("Speak")');
      await page.waitForSelector('.speech-setup');
    }
    await backToLanding();
    await showSpeak();
    assert((await page.locator('.nav-title').textContent()) === 'Speak', 'speech setup screen should be titled Speak');
    const groupHeader = (groupTitle) => page.locator('.speech-setup .credits-header', { hasText: groupTitle });
    const groupTitles = await page.locator('.speech-setup .credits-header').allTextContents();
    assert(groupTitles.join(',') === 'English,Chinese,Spanish,French,Other', `language groups: got ${groupTitles}`);
    assert((await page.locator('.language-row').allTextContents()).join(',').endsWith('zh-CN'), 'only the Chinese group should start shown');
    assert((await page.locator('.language-row').count()) === 1, 'the other groups should start hidden');
    assert((await groupHeader('English').locator('.speech-group-title svg').count()) === 1, 'a hidden group holding the picked language should be checked');
    for (const groupTitle of ['English', 'Spanish', 'French', 'Other']) await groupHeader(groupTitle).click();
    assert((await page.locator('.language-row').count()) === 6, 'every voice language should be listed');
    assert((await groupHeader('English').locator('.speech-group-title svg').count()) === 0, 'a shown group needs no checkmark in its header');
    assertIncludes(await page.locator('.language-row[aria-pressed="true"]').textContent(), 'en-US', 'the browser language should start selected');
    await groupHeader('Chinese').click();
    assert((await page.locator('.language-row').count()) === 5, 'a shown group should hide again');
    assert(!(await page.isChecked('.speech-setup .switch input')), 'Auto Speak should start off');
    assert((await page.locator('.speech-setup .segmented').count()) === 0, 'Summary / Name is only offered while Auto Speak is on');
    assert(await page.isDisabled('.speech-translate-btn'), 'Translate is off while the text and language are both English');
    assert(
      (await page.getAttribute('.speech-sample-header a:has-text("source")', 'href')) === 'https://en.wikipedia.org/wiki/Gettysburg_Address',
      'the Sample Text header should link to the source of the text',
    );
    await page.click('.speech-sample button[aria-label="Play Speech"]');
    await page.waitForSelector('.speech-sample button[aria-label="Pause Speech"]');
    assertIncludes((await lastSpoken()).text, 'Four score', 'Play should speak the sample text');
    assert((await lastSpoken()).lang === 'en-US', 'sample text should be spoken in the selected language');
    await page.waitForSelector('.speech-sample button[aria-label="Play Speech"]');
    await page.click('.speech-setup .toggle-row');
    assert((await page.locator('.speech-setup .segment.selected').textContent()) === 'Summary', 'Auto Speak should start in Summary mode');
    await shot('speak');
    await page.reload();
    await page.waitForSelector('.speech-setup');
    assert(await page.isChecked('.speech-setup .switch input'), 'Auto Speak should survive a reload');
    assert((await page.locator('.language-row').count()) === 5, 'the shown language groups should survive a reload');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');

    console.log('Auto Speak: the slideshow speaks the extract and holds the slide until it is done...');
    await pickFromList('#01');
    assert((await spokenCount()) === 0, 'Auto Speak should stay quiet while the slideshow is paused');
    await page.click('.detail-text button[aria-label="Play Speech"]');
    await page.waitForSelector('.detail-text button[aria-label="Pause Speech"]');
    assertIncludes((await lastSpoken()).text, 'George Washington', 'the detail speech button should speak the extract');
    await page.waitForSelector('.detail-text button[aria-label="Play Speech"]');
    await backToLanding();
    // Longer than the 5s slide interval, so the slide has to wait for it.
    await setSpeechDuration(5000);
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('.detail-text button[aria-label="Pause Speech"]', { timeout: 4000 });
    assert((await spokenCount()) === 2, 'the slideshow should start the speech by itself');
    await page.waitForFunction(() => document.querySelector('.nav-title-mono')?.textContent?.includes('· -'), null, { timeout: 7000 });
    assertIncludes(await title(), '#01', 'the slide should hold while its extract is still being spoken');
    await shot('auto-speak-overtime');
    await page.waitForFunction(() => document.querySelector('.nav-title-mono')?.textContent?.startsWith('#02'), null, { timeout: 4000 });
    assert(!(await title()).includes('· -'), 'the countdown should restart for the next slide');
    await page.click('button[aria-label="Pause"]');

    console.log('Auto Speak Name mode: the order and name are spoken instead of the extract...');
    await setSpeechDuration(300);
    await backToLanding();
    await showSpeak();
    await page.click('.speech-setup .segment:has-text("Name")');
    assertIncludes(await page.locator('.speech-setup .credits-footer').first().textContent(), 'number and name', 'the footer should follow the mode');
    await page.reload();
    await page.waitForSelector('.speech-setup');
    assert((await page.locator('.speech-setup .segment.selected').textContent()) === 'Name', 'the Auto Speak mode should survive a reload');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    await pickFromList('#01');
    await page.click('.detail-text button[aria-label="Play Speech"]');
    await page.waitForSelector('.detail-text button[aria-label="Pause Speech"]');
    assert((await lastSpoken()).text === '1 George Washington', `Name mode should speak the order and name: got ${(await lastSpoken()).text}`);
    await backToLanding();
    await showSpeak();
    await page.click('.speech-setup .segment:has-text("Summary")');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    await resume();

    console.log('Translation: translated sample text makes each extract translated before it is spoken...');
    await setSpeechDuration(300);
    await backToLanding();
    await showSpeak();
    await page.click('.language-row:has-text("es-ES")');
    await page.click('.speech-translate-btn:has-text("Translate to Spanish (Spain)")');
    await page.waitForFunction(() => document.querySelector('.speech-sample textarea')?.value.startsWith('[es] Four score'));
    assertIncludes(await page.locator('.speech-translate-btn').textContent(), 'Translate to English', 'Translate should offer the way back');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    const spokenBefore = await spokenCount();
    await page.click('button:has-text("Start Slideshow")');
    // Two slides in a row: the second translation must start as well as the first.
    await page.waitForFunction((count) => window.__speech.spoken.length >= count + 2, spokenBefore, { timeout: 12000 });
    const translated = await page.evaluate((count) => window.__speech.spoken.slice(count), spokenBefore);
    assert(translated.every((s) => s.text.startsWith('[es] ') && s.lang === 'es-ES'), `extracts should be spoken in Spanish: got ${JSON.stringify(translated.map((s) => [s.lang, s.text.slice(0, 12)]))}`);
    assert(translated[0].text !== translated[1].text, 'each slide should speak its own extract');
    await page.click('button[aria-label="Pause"]');
    // Back to English and Auto Speak off for the rest of the run.
    await backToLanding();
    await showSpeak();
    await page.click('.speech-reset-btn:has-text("Sample Text")');
    assert((await page.locator('.speech-sample textarea').inputValue()).startsWith('Four score'), 'the Sample Text header should restore the default text');
    await page.click('.language-row:has-text("en-US")');
    await page.click('.speech-setup .toggle-row');
    assert(!(await page.isChecked('.speech-setup .switch input')), 'Auto Speak should turn off again');
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Start Slideshow")');
    await resume();

    console.log('Random Head from Landing...');
    await backToLanding();
    await page.click('text=Random Head');
    await page.waitForSelector('.detail-text.visible', { timeout: 4000 });
    await shot('landing-random');

    console.log('Slide Interval / Fadein Delay pickers persist and drive the detail screen...');
    await backToLanding();
    await page.click('.segmented[aria-label="Slide Interval"] >> text=10s');
    const delayLabels = await page.locator('.segmented[aria-label="Fadein Delay"] .segment').allTextContents();
    assert(delayLabels.join(',') === '1.0s,2.0s,4.0s,5.0s', `delay labels should scale with a 10s interval: got ${delayLabels}`);
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
    await shot('landing-slideshow-settings');
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('button[aria-label="Pause"]');
    const tenSecRemaining = parseFloat((await title()).split('· ')[1]);
    assert(tenSecRemaining > 5, `10s interval countdown should start above 5s: got ${tenSecRemaining}`);

    console.log('Back to Landing, then Resume reopens the same HOS, paused...');
    const playingOrder = (await title()).split(' ')[0];
    await backToLanding();
    await resume();
    await page.waitForSelector('button[aria-label="Play"]');
    assertIncludes(await title(), playingOrder, 'Resume should reopen the HOS last shown');

    // Back to the defaults so the natural-tick test below waits out 5s, not 10s.
    await backToLanding();
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
    await page.waitForSelector('button:has-text("Start Slideshow")');
    assert(
      (await page.locator('.segmented[aria-label="Fade Period"] .segment.selected').textContent()) === '2s',
      'Fade Period should survive a reload',
    );
    // Back to the 1s default for the cross-fade check below.
    await page.click('.segmented[aria-label="Fade Period"] >> text="1s"');

    // Sequential (Random Mode off) plays on from whatever is shown, so pick #01 first.
    console.log('Sequential slideshow (Random Mode off) from #01...');
    await pickFromList('#01');
    await backToLanding();
    await page.click('button:has-text("Start Slideshow")');
    await page.waitForSelector('button[aria-label="Pause"]');
    const runningTitle = await title();
    assertIncludes(runningTitle, '·', 'playing title should show a countdown');
    assertIncludes(runningTitle, '#01', 'sequential slideshow should start from the shown HOS');
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
    assertIncludes(await title(), '#02', 'one natural slideshow tick should advance by exactly 1 HOS');

    console.log('Next while playing (should advance and keep playing)...');
    await page.click('button[aria-label="Next"]');
    await page.waitForTimeout(200);
    const afterNextTitle = await title();
    assertIncludes(afterNextTitle, '·', 'slideshow should still be playing after Next');
    assertIncludes(afterNextTitle, '#03', 'sequential Next should move to the next HOS');

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
    await backToLanding();
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
    await backToLanding();
    await page.click('text=Random Mode');

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

    console.log('Page links: the address follows the screen, and opens on the screen it names...');
    const pathname = () => new URL(page.url()).pathname;
    assert(pathname() === '/', `Landing should be at the base address: got ${pathname()}`);
    await page.click('button:has-text("News")');
    await page.waitForSelector('.news-list');
    assert(pathname() === '/News', `News should be at /News: got ${pathname()}`);
    await page.goBack();
    await page.waitForSelector('button:has-text("Resume")');
    assert(pathname() === '/', `browser Back from News should return to Landing: got ${pathname()}`);
    await pickFromList('#16');
    assert(pathname() === '/HOS/16', `a head of state should be at /HOS/NN: got ${pathname()}`);
    await page.click('button[aria-label="Next"]');
    await page.waitForFunction(() => window.location.pathname === '/HOS/17');
    assertIncludes(await page.title(), '#17', 'the page title should name the head of state shown');
    await page.goBack();
    await page.waitForSelector('.hos-list');
    assert(pathname() === '/List', `stepping to the next head should not add a history entry: got ${pathname()}`);
    await page.goto(`${url}HOS/03`);
    await page.waitForSelector('.detail-text h1');
    assertIncludes(await title(), '#03', 'a page link to a head of state should open on them');
    await page.goto(`${url}News`);
    await page.waitForSelector('.news-list');
    await page.goto(url);
    await page.waitForSelector('.news-list');
    assert(pathname() === '/News', `the base address should restore the saved screen and its link: got ${pathname()}`);
    await page.click('button[aria-label="Back"]');
    await page.waitForSelector('button:has-text("Resume")');
    await shot('page-links');

    console.log('Zoom controls on a touch phone (no hover, coarse pointer): shown while paused...');
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const phonePage = await phone.newPage();
    phonePage.on('pageerror', (err) => consoleErrors.push(String(err)));
    await phonePage.goto(url);
    await phonePage.tap('button:has-text("Resume")');
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
