---
name: run-v4
description: Launch and visually verify the v4 React app (headless Chromium via Playwright) — dev server, click-through, screenshots, console/network error check. Use when asked to run, test, or screenshot v4, or to confirm a v4 change works in the browser.
---

# Running & verifying v4 (React port of HO-States-US)

`v4/` is a Vite + React app with no server-side rendering, so "does it work" can only
be answered by actually loading it in a browser. Playwright + a headless Chromium are
already installed as devDependencies in `v4/package.json` — don't reinstall or look for
`chromium-cli` (not present in this environment).

## Quick smoke test (preferred)

```sh
cd v4
npm install        # only if node_modules is missing
npm run smoke
```

`scripts/smoke.mjs` boots the Vite dev server in-process (port 5183), drives Chromium
through the real user flows, and exits non-zero if the page logged any console error or
any network request (including images) returned 4xx/5xx:

Home → List (asserts row shows `#NN Name`) → open a detail row → wait for the 2s
fade-in reveal → Next/Previous/Random toolbar → Back → Back to Home → "Random
President" → "Start Slideshow" → stop it via a toolbar button → Back → "Reset Visit
Count" (asserts the "N left to see" text actually changes).

Screenshots land in `v4/playwright/screenshots/NN-<step>.png` (gitignored) — read the
key ones (`01-home.png`, `04-detail-revealed.png`, `11-slideshow-running.png`) after a
run to visually confirm, don't just trust the exit code for anything design-related.

## Known, correct (not bugs) UX quirks — don't "fix" these

- **Starting the slideshow immediately navigates to a detail screen.** Home's
  "Stop Slideshow" button becomes unreachable until you leave the detail screen —
  this matches the original SwiftUI app, where the pushed detail view covers Home.
  Stop it via Back (pops to empty path) or any detail toolbar button (Previous/
  Random/Next all just stop the slideshow in place while it's running).
- **A screenshot taken right after navigating to a detail screen shows blank
  image/text.** That's the pre-reveal state — `PresidentDetailScreen` fades the
  image+text in ~2s after mount (porting `delaySecs` from `PresidentDetailView.swift`).
  Wait for `.detail-text.visible` before screenshotting if you need the revealed state.
- **Back from a detail screen reached via the list doesn't go straight to Home.**
  The nav stack is `[list, detail]` in that case, so one Back pops to List, a second
  Back pops to Home — same as the SwiftUI `NavigationPath` behavior it ports.

## Manual dev server (for interactive debugging)

```sh
cd v4 && npm run dev -- --port 5183
```

Then either open it yourself, or drive it ad hoc:

```js
// node, ESM
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:5183/');
await page.screenshot({ path: '/tmp/check.png' });
```

Stop the dev server with `lsof -ti:5183 -sTCP:LISTEN | xargs -r kill` before relaunching
it, rather than a broad `pkill`.
