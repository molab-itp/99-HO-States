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
