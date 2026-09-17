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
