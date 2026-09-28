# HO-States-US — v4 (React)

A web port of the [v2](../v2/HO-States-US) SwiftUI app (`HO-States-US.xcodeproj`), built with React
+ Vite. Structured to be React Native-friendly: there is no router (the Settings sheet and drawing
editor are plain overlay state), app state lives in plain context providers, and screens are simple
functional components with no DOM APIs outside of `NavBar`/image/link elements — swapping those
for React Native primitives (`View`, `Image`, `Pressable`, a stack navigator) is the only expected
change to port further.

## Structure

- `src/state/AppModelContext.jsx` — port of `AppModel.swift` (shuffled random draws, viewed-set
  tracking).
- `src/App.jsx` — port of `HO_States_US_App`: opens straight onto `PresidentDetailScreen` at the
  persisted `slideIndex`.
- `src/screens/` — `PresidentDetailScreen` (start screen; Play/Pause slideshow, info button opens
  Settings), `SettingsScreen` (port of `SettingsView`, a full-screen sheet), and
  `PresidentListScreen` (pushed inside Settings).
- `src/state/useStoredValue.js` — `@AppStorage` stand-in; instances for the same key stay in sync.
- `src/data/presidents.json` + `public/images/` — the same portrait images and generated summary
  data as v2's asset catalog / `Resources/Presidents.json` (reused byte-for-byte from the `v3`
  extraction, see `v3/tools/migrate.js`).

## Running

```sh
npm install
npm run dev
```
