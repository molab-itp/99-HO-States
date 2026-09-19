# Session Log

# --

2026-09-17 05:21:12

- Extra Source level folder
- Create as Group vs. Folder

## Request

Create an Xcode SwiftUI project configured for iOS and macOS app development. Begin with a page
that extracts presidential info from https://www.whitehousehistory.org/the-presidents-timeline,
and include a button to download image files.

## Key finding

`whitehousehistory.org/the-presidents-timeline` (and the site root) redirects every automated
request to a donation checkout page (`support.whitehousehistory.org/give/...`), so it cannot be
scraped. The app instead sources presidential biographies and portraits live from Wikipedia's
public REST API (`en.wikipedia.org/api/rest_v1/page/summary/{title}`), keyed off a bundled static
list of the 47 presidencies (order, name, term, party, Wikipedia title).

## What was built

Multiplatform (iOS 17+ / macOS 14+) SwiftUI app, **PresidentialArchive**, generated with
[XcodeGen](https://github.com/yonaskolb/XcodeGen) (installed via Homebrew) since no `.xcodeproj`
existed yet.

- `project.yml` — XcodeGen spec defining two targets (`PresidentialArchive-iOS`,
  `PresidentialArchive-macOS`) sharing one `Sources/PresidentialArchive` tree, plus a macOS
  entitlements file (sandboxed, network client, user-selected file read/write).
- `Sources/PresidentialArchive/PresidentialArchiveApp.swift` — `@main` App entry point.
- `ContentView.swift` — searchable list/detail split view of all presidents.
- `PresidentDetailView.swift` — shows portrait image + Wikipedia bio extract, with a
  **Download Image** button that fetches the full-resolution portrait and presents SwiftUI's
  `.fileExporter` so the user can save it (works identically on iOS and macOS, no Photos
  permission needed).
- `PresidentDetailViewModel.swift` — `@Observable` view model driving the async Wikipedia fetch.
- `Models/President.swift`, `Models/WikipediaSummary.swift` — data models.
- `Services/WikipediaService.swift` — async fetch of bio summaries and image bytes.
- `Services/PresidentsRepository.swift` — loads the bundled `Presidents.json`.
- `Support/ImageDocument.swift` — `FileDocument` wrapper enabling the cross-platform file export.
- `Support/macOS.entitlements` — sandbox entitlements for macOS target.
- `Resources/Presidents.json` — static dataset of all 47 presidencies through the current term.
- `Resources/Assets.xcassets` — `AppIcon` and `AccentColor` placeholders.
- `.gitignore` — ignores `xcuserdata/`, `DerivedData/`, `.DS_Store`.

## Verification

- Installed `xcodegen` via Homebrew; ran `xcodegen generate` to produce
  `PresidentialArchive.xcodeproj`.
- Pointed `xcode-select` at the full Xcode install (`Xcode_26.6_r2.app`) so `xcodebuild` works
  (previously only Command Line Tools were active).
- Fixed a `GENERATE_INFOPLIST_FILE` build setting issue (code signing failed without it).
- `xcodebuild ... -scheme PresidentialArchive-macOS -destination 'platform=macOS' build` →
  **BUILD SUCCEEDED**.
- `xcodebuild ... -scheme PresidentialArchive-iOS -destination 'generic/platform=iOS Simulator' build`
  → **BUILD SUCCEEDED**.

## Follow-up notes

- After editing `project.yml`, re-run `xcodegen generate` to regenerate the `.xcodeproj`.
- `project.yml` was reformatted (quote style normalized) between requests, likely by XcodeGen or
  an editor formatter — no functional change.

# --

2026-09-17 (v2 session)

## Request

Build out `v2/US-Headers`: a CLI tool to fetch presidential data/portraits from Wikipedia into
`v2/US-Headers/US-Headers.xcodeproj`'s asset catalog, then SwiftUI screens to browse it, then fix
incorrect portraits for the two nonconsecutive presidents.

## What was built

- `v2/Tools/GenerateAssets` — standalone Swift Package executable (`swift run GenerateAssets`).
  - Bundled seed list of all 47 presidencies (order/name/term/party/Wikipedia title).
  - Fetches each Wikipedia `page/summary`, downloads both a thumbnail and a larger/original
    image, and writes each as an `NN Name[ Large].imageset` into
    `v2/US-Headers/US-Headers/Assets.xcassets` (order-padded name keeps duplicate names like
    Cleveland/Trump unique).
  - Writes a plain `Resources/Presidents.json` (order, name, term, party, wikipediaTitle,
    extract, thumbnailImageName, largeImageName) alongside the app sources — picked up
    automatically since the target uses Xcode's file-system-synchronized group — loadable via
    `Bundle.main.url(forResource:withExtension:)`.
  - Added a `commonsFile` override on the seed data for orders 22, 24, 45, 47 (Cleveland's two
    terms and Trump's two terms) pointing at the exact Wikimedia Commons portrait filenames used
    on Wikipedia's "List of presidents" page, since the person's canonical Wikipedia article page
    only exposes one portrait regardless of which term is being rendered. Downloads these via
    Commons' `Special:FilePath/<file>?width=N` redirect instead of the article summary image.
- `v2/US-Headers/US-Headers/Models/President.swift`, `Services/PresidentsRepository.swift`,
  `Support/ImageAvailability.swift` — app-side model/loader plus a helper that only returns an
  `Image` if the named asset actually exists.
- `ContentView.swift` — `NavigationStack` + `List` of presidents with circular thumbnails.
- `PresidentDetailView.swift` — large portrait, bio extract, and a bottom toolbar with
  Previous / Random / Next buttons that move an in-place index (Previous/Next disabled at the
  ends; Random avoids repeating the current entry).

## Verification

- `swift build` / `swift run GenerateAssets` in `v2/Tools/GenerateAssets` — populated all 47
  thumbnail + large imagesets and `Resources/Presidents.json`.
- `xcodebuild -project US-Headers.xcodeproj -scheme US-Headers -destination 'generic/platform=iOS Simulator' -sdk iphonesimulator build`
  → **BUILD SUCCEEDED**.
- Confirmed via `md5` that imagesets `22 Grover Cleveland`, `24 Grover Cleveland`,
  `45 Donald Trump`, `47 Donald Trump` now contain four distinct image files (previously 22/24
  and 45/47 were identical because both terms shared one Wikipedia article portrait).

## Follow-up notes

- Path arithmetic for locating `Assets.xcassets`/`Resources` from `#filePath` inside the tool is
  fragile if the package is moved — first attempt was off by one directory level and briefly
  wrote a stray `v2/Tools/US-Headers` folder (cleaned up).
- Re-run `swift run GenerateAssets` from `v2/Tools/GenerateAssets` any time to refresh data/images.

# --

2026-09-17 (v2 session, continued)

## Request

Polish `v2/US-Headers`: delayed detail reveal in `PresidentDetailView`, a preview, a proper
starting screen, and a slideshow feature — then fix a bug in the slideshow.

## What was built

- `PresidentDetailView.swift`
  - Detail text (name, term/party, bio extract) now starts hidden and fades in (`easeIn`, 0.5s)
    5 seconds after the president shown changes, via `.task(id: index)`; the portrait image is
    outside that opacity group so it still appears immediately.
  - Added a `#Preview` that loads `PresidentsRepository.loadAll()` and wraps the view in a
    `NavigationStack` (required for its title/toolbar to render in the preview).
- `HomeView.swift` (new) — app's starting screen:
  - Owns the root `NavigationStack` (with a bound `NavigationPath`) and declares the shared
    `navigationDestination` for both `HomeDestination.list` (→ `ContentView`) and `President`
    (→ `PresidentDetailView`).
  - **List of Presidents** button, **Random President** button, and a **Source: Wikipedia**
    `Link` to the presidents list page.
  - **Start/Stop Slideshow** button: jumps to a random president immediately, then a repeating
    background `Task` swaps in a new random president every 5 seconds; toggling/back navigation
    cancels the loop.
- `ContentView.swift` — no longer owns its own `NavigationStack`/`navigationDestination`; it's now
  a plain pushed screen (`presidents` passed in) since `HomeView` owns the stack.
- `US_HeadersApp.swift` — launches `HomeView` instead of `ContentView`.

## Bug fix: slideshow stopped after one jump

- Symptom: tapping **Start Slideshow** jumped to a random president once but never advanced again
  after 5 seconds.
- Root cause: the tick handler did `path.removeLast()` then `goToRandomPresident()` (which
  appended). The `removeLast()` briefly made `path` empty, which fired
  `.onChange(of: path) { if newPath.isEmpty { stopSlideshow() } }` and self-cancelled the very
  task that was running the loop — so only the first jump ever happened.
- Fix: `goToRandomPresident()` now builds a fresh `NavigationPath` containing just the new
  president and assigns it to `path` in one atomic step, so `path` never passes through an empty
  state during a slideshow tick.

## Verification

- `xcodebuild -project US-Headers.xcodeproj -scheme US-Headers -destination 'generic/platform=iOS Simulator' -sdk iphonesimulator build`
  → **BUILD SUCCEEDED** after each change (fade-in, preview, HomeView/slideshow, and the bug fix).

# --

2026-09-17 (v2 session, continued again)

## Request

Slideshow still wasn't advancing after the previous fix; add a countdown (in tenths of a second)
to the detail view's nav title; once it finally worked, stop the slideshow whenever a
Previous/Next/Random button is tapped on the detail view.

## Attempt: switch to a Timer

Replaced the async `Task`-based tick loop in `HomeView` with a Foundation `Timer` (0.1s interval,
added to the run loop in `.common` mode so it keeps firing during scrolling), decrementing a
`slideshowRemainingTenths` counter and jumping when it hits zero. `PresidentDetailView` gained an
optional `slideshowCountdownTenths: Int?` shown in its nav title as `#<order> · <seconds>.<tenth>s`
when the slideshow is active. This built fine but **still didn't advance** — the countdown ticked
down but the displayed president never changed.

## Actual root cause found

Not a timing bug at all: `NavigationStack` reuses the same `PresidentDetailView` instance (and its
`@State private var index`) whenever only the _value_ at an existing stack position changes —
`init`'s `State(initialValue:)` only applies the very first time that view identity is created.
So each slideshow tick correctly replaced `path`'s president and the countdown text updated (a
plain, non-`@State` property refreshed every render), but `index` — and therefore the president
actually shown — never budged.

**Fix:** added `.id(president.id)` to the `PresidentDetailView` inside `HomeView`'s
`navigationDestination(for: President.self)`, forcing SwiftUI to create a brand-new view (and
fresh `@State index`) whenever the president differs, including repeated swaps at the same stack
position during the slideshow. Confirmed working by the user ("success!").

## Stop slideshow on manual navigation

Added `onManualNavigation: (() -> Void)?` to `PresidentDetailView`, invoked at the top of
`goToPrevious()`/`goToNext()`/`goToRandom()`. `HomeView` passes its `stopSlideshow` method as that
callback, so tapping any detail-view navigation button cancels an active slideshow.

## Verification

- `xcodebuild -project US-Headers.xcodeproj -scheme US-Headers -destination 'generic/platform=iOS Simulator' -sdk iphonesimulator build`
  → **BUILD SUCCEEDED** after the Timer attempt, the `.id(president.id)` fix, and the
  `onManualNavigation` wiring.

## Follow-up notes

- Lesson: when a `NavigationStack` destination's displayed value changes while its position in the
  path stays the same, give the destination view `.id(value.id)` (or similar) if it owns `@State`
  seeded from an initializer argument — otherwise that `@State` silently goes stale on future
  updates.

# --

2026-09-17 (v3: plain-JS port)

## Request

Convert the Swift app in `v2` to a plain JavaScript app, stored in a new `v3` folder.

## What was built

- `v3/tools/migrate.js` — one-time Node script that reads `v2/US-Headers/US-Headers/Resources/Presidents.json`,
  copies each president's thumbnail/large portrait out of the `Assets.xcassets` imagesets into
  `v3/images/<order>-thumb.<ext>` / `<order>-large.<ext>`, and writes `v3/data/presidents.json`
  with plain relative image paths (order, name, term, party, wikipediaTitle, extract, thumbnail,
  large). Run once to produce all 47 entries + 94 images (jpg/jpeg preserved as-is).
- `v3/index.html`, `v3/styles.css`, `v3/app.js` — dependency-free static SPA, no build step:
  - Hash-based router: `#/` (home), `#/list`, `#/president/<order>`.
  - **Home**: List/Random/Slideshow buttons + Wikipedia source link (mirrors `HomeView.swift`).
  - **List**: circular thumbnails + name/term rows (mirrors `ContentView.swift`).
  - **Detail**: portrait shows immediately; name/term/party/extract fade in 2s later via a CSS
    `.visible` class toggle; Previous/Random/Next toolbar (mirrors `PresidentDetailView.swift`).
  - **Slideshow**: jumps to a random president immediately, then every 5s via `setInterval(…, 100)`
    ticking a tenths-of-a-second counter; nav title shows a zero-padded, monospaced countdown
    (`#16 · 03.2s`); "soft" navigations (slideshow ticks, Previous/Next/Random) use
    `history.replaceState` + manual re-render so they don't grow the back stack, while entering the
    detail view from Home/List uses a real hash push. Manual Previous/Next/Random and navigating
    back to `#/` both stop the slideshow — same behavior as the Swift version.

## Verification

- Validated `data/presidents.json` with `python3 -m json.tool` and `app.js` with `node -c`.
- Served the folder with `python3 -m http.server` and smoke-tested all static assets (200s for
  `index.html`, `app.js`, `styles.css`, `data/presidents.json`, sample images).
- Used the integrated browser to click through Home → List → Detail, confirmed the 2s text
  fade-in, started the slideshow and observed it auto-advance (e.g. `#18` → `#05`) with a live
  countdown title, then confirmed clicking **Next** stopped the slideshow (title reverted to plain
  `#14`, no further auto-advance after waiting).

## Follow-up notes

- `v3/tools/migrate.js` is a one-time/rerunnable migration tool, not part of the served app; rerun
  it after regenerating `v2`'s assets (e.g. via `GenerateAssets`) to refresh `v3/data` and
  `v3/images`.

# --

2026-09-18 (v2 session: article link)

## Request

Update `v2/Tools/GenerateAssets/Sources/GenerateAssets/main.swift` to include a link to each
president's Wikipedia article, and surface that link in
`v2/US-Headers/US-Headers/PresidentDetailView.swift`.

## What was built

- `main.swift` — added `WikipediaPageURL`/`WikipediaContentURLs` (decoding the summary API's
  `content_urls.desktop.page`, with explicit `CodingKeys` for the snake_case JSON key) and a new
  `articleURL: String?` field on `PresidentSummary`, populated from
  `summary.contentUrls?.desktop.page` and written into `Resources/Presidents.json`.
- `Models/President.swift` — added matching `articleURL: String?` (optional, so older
  `Presidents.json` files without the field still decode) plus a computed
  `wikipediaArticleURL: URL?` that uses the generated URL when present, otherwise falls back to
  constructing `https://en.wikipedia.org/wiki/<Title>` from `wikipediaTitle` so the link works even
  before `GenerateAssets` is re-run.
- `PresidentDetailView.swift` — added a "Read on Wikipedia" `Link` below the bio extract.

## Bug fix: `navigationTitle(_:)` build error

- Symptom: `error: Only unstyled text can be used with navigationTitle(_:)`.
- Root cause: `navigationTitleView` (the fixed-width monospaced `#NN · secondss` title, added in an
  earlier session) applied `.font(.system(.body, design: .monospaced))` to the `Text` passed into
  `.navigationTitle(_:)`; that API only accepts an unstyled `Text`.
- Fix: dropped `.navigationTitle(navigationTitleView)` and instead render
  `navigationTitleView` (now `some View`, unchanged internals) via a
  `ToolbarItem(placement: .principal)`, which has no such restriction and keeps the no-jiggle
  monospaced behavior for the countdown digits.

## Verification

- Pointed `xcodebuild` at the installed `Xcode_26.6.app` via `DEVELOPER_DIR` (only Command Line
  Tools were active by default, no full Xcode selected).
- `swift build` in `v2/Tools/GenerateAssets` → **Build complete**.
- `xcodebuild -project US-Headers.xcodeproj -scheme US-Headers -destination 'generic/platform=iOS Simulator' -quiet build`
  → **exit 0**, both before and after the `navigationTitle` fix.

## Follow-up notes

- `Resources/Presidents.json` still has `articleURL: null` for every entry until `GenerateAssets`
  is re-run against the network; the `wikipediaArticleURL` fallback covers the UI in the meantime.

# --

2026-09-18 (v2 session: AppModel + slideshow button behavior) — v2.18–v2.20

## Request

1. Create an `AppModel` that builds an initial shuffled array of president indexes, used for
   random president selection; the Random button should draw the next entry from that array.
2. While the slideshow is running, a bottom-toolbar button press in `PresidentDetailView.swift`
   should just stop the slideshow in place instead of performing its usual action.

## What was built

- `AppModel.swift` (new) — `@Observable` class owning the loaded `presidents` array plus a
  shuffled permutation of its indices (`shuffledIndexes`). `nextRandomPresident()` walks that
  shuffle in order via `nextDrawPosition`, reshuffling (and swapping the first two entries if the
  new shuffle's first pick would repeat the just-served president) once the shuffle is exhausted —
  so random draws cycle through everyone before any repeat, instead of independent
  `Int.random`/`randomElement()` calls each time.
- `US_HeadersApp.swift` — now owns `@State private var appModel = AppModel()` and injects it via
  `.environment(appModel)` on `HomeView`.
- `HomeView.swift` — reads `@Environment(AppModel.self)` instead of loading its own `presidents`
  array; **Random President** button and the slideshow's auto-advance both now call
  `appModel.nextRandomPresident()`.
- `PresidentDetailView.swift` — reads `@Environment(AppModel.self)`; its **Random** toolbar button
  now calls `appModel.nextRandomPresident()` and looks up the returned president's index, dropping
  the old retry-`while newIndex == index` loop.
- `PresidenttListView.swift`, and the `#Preview`s in all three views — updated to supply an
  `AppModel` via `.environment(...)` since `PresidentDetailView` now requires one from the
  environment.
- `PresidentDetailView.swift` (slideshow button behavior) — added `isSlideshowActive` (true
  whenever `slideshowCountdownTenths != nil`) and `handleToolbarButton(_:)`: while the slideshow is
  active, any of Previous/Random/Next now just calls `onManualNavigation?()` (stopping the
  slideshow) and returns, leaving the currently shown president in place, instead of also
  navigating; once stopped, the buttons resume their normal behavior. `goToPrevious`/`goToNext`/
  `goToRandom` no longer call `onManualNavigation?()` themselves. Relaxed the Previous/Next
  `.disabled` conditions to `!isSlideshowActive && ...` so they stay tappable (to stop the
  slideshow) even at the first/last president while it's running.

## Verification

- `xcodebuild -project US-Headers.xcodeproj -scheme US-Headers -destination 'generic/platform=iOS Simulator' -quiet build`
  → **exit 0** after the `AppModel` refactor and again after the slideshow button-behavior change
  (via `DEVELOPER_DIR=/Applications/Xcode_26.6.app/Contents/Developer xcodebuild ...`, since only
  Command Line Tools were selected by default).

# --

2026-09-19 (v4: React port + headless browser tooling)

## Request

1. In `v2/HO-States-US/HO-States-US/PresidenttListView.swift`, display each president's number
   along with their name in the list row.
2. Create a new top-level `v4` folder containing an HTML/JavaScript version of
   `v2/HO-States-US/HO-States-US.xcodeproj`, matching it as closely as possible using React, built
   for the web but structured to stay friendly to a future React Native port.
3. Set up a headless-browser tool (`chromium-cli`/Playwright) so UI changes can actually be
   verified instead of just built.

## What was built

### PresidenttListView number

- `PresidentRow` now renders `"#\(String(format: "%02d", president.order)) \(president.name)"` as
  the headline, matching the leading-zero monospaced `#NN` format already used in
  `PresidentDetailView`'s nav title.

### `v4` — React port

Reused (not re-extracted) the portrait images and generated JSON that `v3/tools/migrate.js` had
already copied byte-for-byte out of `v2`'s asset catalog, rather than duplicating another ~117MB
out of `Assets.xcassets`.

- `src/state/AppModelContext.jsx` — direct port of `AppModel.swift`: shuffled-bag random draws
  (`nextRandomPresident`, reshuffling without repeating the last-served entry) and a `viewedIDs`
  `Set` driving the progress bar / "N left to see" count.
- `src/navigation/NavigationContext.jsx` — a minimal in-memory stack navigator standing in for
  `NavigationStack`/`NavigationPath` (`pushList`, `pushDetail`, `replaceWithDetail`, `pop`), with
  no `react-router`/URL coupling so it could back a React Native stack navigator later. Each push
  carries a unique `navKey`, used as the React `key` on the destination screen — the equivalent of
  SwiftUI's `.id(president.id)` trick for forcing a fresh `PresidentDetailScreen` instance (and
  `index` state) on every new push, including the slideshow.
- `src/state/SlideshowContext.jsx` — port of `HomeView`'s `Timer`-based slideshow loop (5s /
  100ms-tick countdown), lifted to a context (rather than living on the Home screen component like
  the Swift version) because the navigator here only mounts the topmost screen, unlike SwiftUI
  keeping `HomeView` mounted underneath whatever it pushes — this is what keeps the timer alive
  across screen changes instead. Stops itself when the nav path goes empty, mirroring
  `.onChange(of: path)`.
- `src/screens/{Home,PresidentList,PresidentDetail}Screen.jsx` — one per SwiftUI view of the same
  shape, including the 2s delayed fade-in reveal, Previous/Random/Next toolbar (disabled at
  boundaries unless the slideshow is active, in which case any of the three just stops it in
  place), the "Read on Wikipedia" link, and the segmented red/green/yellow viewed-progress bar.
- `src/components/{NavBar,ViewedProgressBar,PresidentThumb}.jsx` — small shared pieces; `NavBar`
  stands in for SwiftUI's automatic inline nav bar (back button + centered title).
- Plain Vite + React (JS, no TypeScript, no `react-router`) — `package.json`, `vite.config.js`,
  `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css`.
- `README.md` documenting the structure and the "what would change to port to React Native" split.

One deliberate deviation: since only the topmost screen is mounted, the list screen's scroll
position resets on `List → Detail → Back`, unlike SwiftUI keeping it alive underneath.

### Headless browser tooling

`chromium-cli` (referenced by the bundled `run` skill) isn't installed in this environment, so
used the real Playwright package instead:

- Installed `playwright` as a `v4` devDependency and ran `npx playwright install chromium`.
- `v4/scripts/smoke.mjs` (`npm run smoke`) — boots the Vite dev server in-process via Vite's JS
  API, drives headless Chromium through Home → List (asserts `#NN Name` rows) → open a detail row
  → wait for the 2s reveal → Previous/Random/Next → Back → Back to Home → Random President →
  Start Slideshow → stop it via a toolbar button → Reset Visit Count (asserts the "N left to see"
  text actually changes) — screenshotting every step into `v4/playwright/screenshots/` (gitignored)
  and failing on any console error or any network request returning 4xx/5xx.
- `.claude/skills/run-v4/SKILL.md` (new) — captures the setup and, importantly, three UX behaviors
  the first smoke-test run flagged as failures that turned out to be correct, faithful ports of the
  Swift app's actual behavior (documented as "don't fix these"):
  - Back from a detail screen reached via the list pops to List first, then Home (nav stack is
    `[list, detail]` there), not straight to Home.
  - Starting the slideshow immediately navigates to a detail screen, so Home's "Stop Slideshow"
    button is unreachable until you leave it — matches `HomeView`'s pushed `PresidentDetailView`
    covering Home in the original app.
  - A screenshot taken immediately after navigating to a detail screen shows a blank image/text
    area — that's the pre-reveal state, not a broken image.

## Verification

- `npm install` / `npm run build` in `v4` — build succeeds, `dist/images/` contains all 94
  portraits.
- `npm run smoke` — full click-through passes with **zero console errors and zero failed network
  requests**; visually reviewed the resulting screenshots (Home, List with `#NN Name` rows, a
  fully-revealed detail screen, the slideshow countdown title `#10 · 05.0s`) and confirmed each
  matches the intended design.
- No headless-browser tool was available on the very first pass (before installing Playwright), so
  that initial `v4` build was instead verified via `npm run build`, a running dev server smoke-
  tested with `curl`, and a line-by-line comparison against the Swift source.

## Follow-up notes

- `v4/README.md` and `.claude/skills/run-v4/SKILL.md` are the two places documenting the
  React-Native-porting seams and the "known, correct" UX quirks respectively — check both before
  assuming a future `v4` smoke-test failure is a real regression.
- Re-run `v3/tools/migrate.js` after regenerating `v2`'s assets, then re-copy `v3/images` →
  `v4/public/images` and `v3/data/presidents.json` → `v4/src/data/presidents.json`, to refresh
  `v4`'s data/portraits.
