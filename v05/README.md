# HO-States-US — v4 (React)

A web port of the [v2](../v2/HOS-USnA) SwiftUI app (`HOS-USnA.xcodeproj`), built with React
+ Vite. Structured to be React Native-friendly: there is no router (the current screen is plain
app state, and the drawing editor is overlay state), app state lives in plain context providers,
and screens are simple functional components with no DOM APIs outside of `NavBar`/image/link
elements — swapping those for React Native primitives (`View`, `Image`, `Pressable`, a stack
navigator) is the only expected change to port further.

## Structure

- `src/state/AppModelContext.jsx` — port of `AppModel.swift` (shuffled random draws, viewed-set
  tracking, the current `screen` and `slideIndex`).
- `src/App.jsx` — port of `AppLandingView`: shows `LandingScreen` as the root, with the list, detail,
  news, credits and speech setup screens on top of it, and reopens on the persisted `screen` after
  a reload.
- `src/screens/` — `LandingScreen` (port of `LandingView`: Resume, News, List of Heads, Random
  Head, Speak, Start Slideshow, slideshow settings, Reset Visit Count, Credits, links),
  `HOSListScreen`, `HOSDetailScreen` (Play/Pause slideshow, speech button, drawing, Back to
  Landing), `NewsScreen` (port of `NewsView`), `CreditsScreen` (port of `CreditsView`: article,
  photo and news sources, each section collapsible), and `SpeechSetupScreen` (port of
  `SpeechSetupView`: Auto Speak and its Summary / Name mode, sample text with a link to its
  source, and the speech languages in groups that can each be shown or hidden).
- `src/state/useSpeechPlayer.js` — port of `SpeechPlayer.swift` on the Web Speech API
  (`speechSynthesis`); `src/state/speechSettings.js` is the port of `SpeechSettings`.
- `src/components/SpeechPlayButton.jsx` — port of `SpeechPlayButton` and
  `SpeechTranslatedPlayButton`. Translation (`src/data/translator.js`) uses the browser's built-in
  Translator API where there is one (Chrome on desktop); elsewhere the Translate button is hidden
  and text is spoken as written.
- `src/data/appScreen.js` — port of `AppScreen.swift`, the top-level screen names.
- `src/data/route.js` — page links, so a location can be bookmarked: `News`, `List`, `Credits`,
  `Speech` and `HOS/NN` (one per head of state) under the app's base, e.g.
  `https://molab-itp.github.io/99-HO-States/v05/News` or `.../v05/HOS/16`. Still no router: the
  address bar is kept in step with `screen`/`slideIndex` and read on load and on browser
  Back/Forward. The base address itself reopens the last screen shown. The build
  (`vite.config.js`) writes a copy of `index.html` for every link (`News.html`, `HOS/16.html`),
  which is what lets GitHub Pages serve them.
- `src/state/useStoredValue.js` — `@AppStorage` stand-in; instances for the same key stay in sync.
- `src/data/hos.json` + `public/images/` — the same portrait images and generated summary
  data as v2's asset catalog / `Resources/HOS.json` (reused byte-for-byte from the `v3`
  extraction, see `v3/tools/migrate.js`).
- `src/data/links.json` — copy of v2's `Resources/Links.json`.
- `src/data/news.json` + `public/images/news/` — copy of v2's `Resources/news.json` and the
  thumbnails it names in v2's asset catalog (`src/data/news.js` maps each name to its file).
- `src/data/photoCredits.json` — copy of v2's generated `Resources/PhotoCredits.json`.

## Running

```sh
npm install
npm run dev
```
