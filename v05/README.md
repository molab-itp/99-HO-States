# HO-States-US — v4 (React)

A web port of the [v2](../v2/HO-States-US) SwiftUI app (`HO-States-US.xcodeproj`), built with React
+ Vite. Structured to be React Native-friendly: there is no router (the current screen is plain
app state, and the drawing editor is overlay state), app state lives in plain context providers,
and screens are simple functional components with no DOM APIs outside of `NavBar`/image/link
elements — swapping those for React Native primitives (`View`, `Image`, `Pressable`, a stack
navigator) is the only expected change to port further.

## Structure

- `src/state/AppModelContext.jsx` — port of `AppModel.swift` (shuffled random draws, viewed-set
  tracking, the current `screen` and `slideIndex`).
- `src/App.jsx` — port of `AppLandingView`: shows `LandingScreen` as the root, with the list and
  detail screens on top of it, and reopens on the persisted `screen` after a reload.
- `src/screens/` — `LandingScreen` (port of `LandingView`: Resume, List of Heads, Random Head,
  Start Slideshow, slideshow settings, links), `HOSListScreen`, and `HOSDetailScreen`
  (Play/Pause slideshow, drawing, Back to Landing).
- `src/data/appScreen.js` — port of `AppScreen.swift`, the top-level screen names.
- `src/state/useStoredValue.js` — `@AppStorage` stand-in; instances for the same key stay in sync.
- `src/data/hos.json` + `public/images/` — the same portrait images and generated summary
  data as v2's asset catalog / `Resources/HOS.json` (reused byte-for-byte from the `v3`
  extraction, see `v3/tools/migrate.js`).
- `src/data/links.json` — copy of v2's `Resources/Links.json`.

## Running

```sh
npm install
npm run dev
```
