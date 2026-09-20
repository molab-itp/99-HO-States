# HO-States-US — v4 (React)

A web port of the [v2](../v2/HO-States-US) SwiftUI app (`HO-States-US.xcodeproj`), built with React
+ Vite. Structured to be React Native-friendly: navigation is a small in-memory stack (no
`react-router`/URL coupling), app state lives in plain context providers, and screens are simple
functional components with no DOM APIs outside of `NavBar`/image/link elements — swapping those
for React Native primitives (`View`, `Image`, `Pressable`, a stack navigator) is the only expected
change to port further.

## Structure

- `src/state/AppModelContext.jsx` — port of `AppModel.swift` (shuffled random draws, viewed-set
  tracking).
- `src/navigation/NavigationContext.jsx` — port of `HomeView`'s `NavigationPath` stack.
- `src/state/SlideshowContext.jsx` — port of `HomeView`'s slideshow timer.
- `src/screens/` — `HomeScreen`, `PresidentListScreen`, `PresidentDetailScreen`, one per SwiftUI
  view of the same shape.
- `src/data/presidents.json` + `public/images/` — the same portrait images and generated summary
  data as v2's asset catalog / `Resources/Presidents.json` (reused byte-for-byte from the `v3`
  extraction, see `v3/tools/migrate.js`).

## Running

```sh
npm install
npm run dev
```
