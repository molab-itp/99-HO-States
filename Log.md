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
