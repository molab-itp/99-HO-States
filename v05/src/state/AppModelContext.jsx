import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import hosList from '../data/hosList.js';
import { version as appVersion } from '../../package.json';
import { loadPersistedState, savePersistedState } from '../data/persistedState.js';
import { normalizeReactions } from '../data/hosReaction.js';
import { deleteDrawing, loadAllDrawings, saveDrawing } from '../data/hosDrawingStore.js';
import { DEFAULT_DRAWING_DISPLAY_MODE, normalizeDrawingDisplayModes } from '../data/drawingDisplayMode.js';
import { AppScreen, normalizeAppScreen } from '../data/appScreen.js';
import { routeFromLocation, showRoute } from '../data/route.js';

const AppModelContext = createContext(null);

function shuffledIndexes(count) {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Port of AppModel.swift. Owns the loaded HOS list and a shuffled draw order used by
 * every "Random" control, so random selection cycles through the full set before repeating
 * instead of drawing independently each time. Also tracks which heads of state have been viewed,
 * driving the progress bar on the detail screen and the "left to see" count on Landing.
 */
export function AppModelProvider({ children }) {
  // Loaded once per provider mount — a stand-in for `AppModel.init`'s `loadPersistedState()`.
  // Guards against a stale entry left over from a build with a different HOS count (e.g.
  // after adding/removing entries) producing an out-of-range index, same as the Swift version.
  const persistedRef = useRef(undefined);
  const rawPersistedRef = useRef(null);
  if (persistedRef.current === undefined) {
    const persisted = loadPersistedState();
    rawPersistedRef.current = persisted;
    persistedRef.current =
      persisted && Array.isArray(persisted.shuffledIndexes) && persisted.shuffledIndexes.length === hosList.length
        ? persisted
        : null;
  }
  const persisted = persistedRef.current;

  // The screen the page's address names (see `route.js`), if it names one: a bookmarked or shared
  // link opens there, ahead of whatever screen was saved. Read once, like the saved state.
  const initialRouteRef = useRef(undefined);
  if (initialRouteRef.current === undefined) initialRouteRef.current = routeFromLocation(hosList);
  const initialRoute = initialRouteRef.current;

  const shuffleRef = useRef(persisted ? persisted.shuffledIndexes : shuffledIndexes(hosList.length));
  // Walks `shuffleRef` in order, wrapping back to 0 once every index has been served. The
  // permutation itself is only ever redealt by `resetViewed()` (via `reshuffle()` below) — never
  // here — so resuming a random-mode slideshow just continues walking the same order instead of
  // starting a fresh one.
  const nextShuffleIndexRef = useRef(persisted ? (persisted.nextShuffleIndex ?? 0) : 0);
  const viewedIDsRef = useRef(new Set());
  const [viewedIDs, setViewedIDs] = useState(() => new Set());

  // Number of times the shuffle has been (re)dealt — the initial deal plus every reshuffle from
  // `resetViewed()` — so `buildInfo` can tell how many full random cycles have been dealt.
  const [cycleCount, setCycleCount] = useState(1);

  // Which HOS `HOSDetailScreen` is currently showing, as an index into `hosList`.
  // Lives here (rather than only as local state on the screen) so it survives that screen being
  // unmounted and remounted — e.g. a non-random slideshow that's stopped and later restarted
  // picks up from this index instead of always restarting at the first HOS.
  const [slideIndex, setSlideIndex] = useState(() => {
    if (initialRoute?.slideIndex !== undefined) return initialRoute.slideIndex;
    return persisted && hosList[persisted.slideIndex] ? persisted.slideIndex : 0;
  });

  // The top-level screen currently showing, set by `App`'s navigation and persisted so the next
  // launch reopens on the same screen. Read from the raw saved state rather than `persisted`: it
  // doesn't depend on the shuffle matching the current HOS count. Older saves without it (or
  // with a screen this build doesn't know) fall back to Landing. A page link wins over both.
  const [screen, setScreen] = useState(
    () => initialRoute?.screen ?? normalizeAppScreen(rawPersistedRef.current?.screen),
  );

  // Keeps the address bar on the page link for what's showing. Moving to another screen adds a
  // history entry; the first sync (which may be restoring the saved screen at the app's base
  // address) and a change of HOS within the detail screen rewrite the current one.
  const syncedScreenRef = useRef(null);
  useEffect(() => {
    const isNewScreen = syncedScreenRef.current !== null && syncedScreenRef.current !== screen;
    syncedScreenRef.current = screen;
    showRoute(screen, hosList[slideIndex], isNewScreen);
  }, [screen, slideIndex]);

  // The browser's Back/Forward: show whatever the address now names. `showRoute` then finds the
  // address already matching and leaves the history alone.
  useEffect(() => {
    function handlePopState() {
      const route = routeFromLocation(hosList);
      if (route?.slideIndex !== undefined) setSlideIndex(route.slideIndex);
      setScreen(route?.screen ?? AppScreen.landing);
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Makes `hos` the one `HOSDetailScreen` shows when it's next opened.
  const select = useCallback((hos) => {
    const index = hosList.findIndex((h) => h.order === hos.order);
    if (index >= 0) setSlideIndex(index);
  }, []);

  // User-picked feedback and per-HOS pinch-zoom/pan state, keyed by `hos.order`.
  // Ported from `AppModel.swift`'s `reactions`/`imageZoomStates`.
  const [reactions, setReactions] = useState(() => normalizeReactions(persisted?.reactions));
  const [imageZoomStates, setImageZoomStates] = useState(() => persisted?.imageZoomStates ?? {});

  // Per-HOS choice from the eye menu (photo, photo + drawing, or drawing only). An HOS
  // with no entry uses the default, photo + drawing. Ported from `AppModel.swift`'s
  // `drawingDisplayModes`; older saves without it load as all-default.
  const [drawingDisplayModes, setDrawingDisplayModes] = useState(() =>
    normalizeDrawingDisplayModes(persisted?.drawingDisplayModes),
  );

  // Each HOS's saved photo drawing (see `hosDrawingStore.js`), overlaid on the
  // portrait by `ZoomableHeaderImage`. Ported from `AppModel.swift`'s `drawingFileNames`, except
  // the strokes themselves are held here rather than a file name pointing at a PNG.
  const [drawings, setDrawings] = useState(() => loadAllDrawings(hosList));

  const nextRandomHOS = useCallback(() => {
    if (hosList.length === 0) return null;

    if (nextShuffleIndexRef.current >= shuffleRef.current.length) {
      nextShuffleIndexRef.current = 0;
    }

    const hos = hosList[shuffleRef.current[nextShuffleIndexRef.current]];
    nextShuffleIndexRef.current += 1;
    return hos;
  }, []);

  // Deals a fresh shuffle and rewinds the sequential slideshow back to the first HOS. This
  // is the only place the random draw order is ever reshuffled — `nextRandomHOS()` just
  // walks (and wraps within) whatever permutation was last dealt here.
  const reshuffle = useCallback(() => {
    shuffleRef.current = shuffledIndexes(hosList.length);
    nextShuffleIndexRef.current = 0;
    setCycleCount((c) => c + 1);
    setSlideIndex(0);
  }, []);

  const resetViewed = useCallback(() => {
    viewedIDsRef.current = new Set();
    setViewedIDs(new Set());
    reshuffle();
  }, [reshuffle]);

  const markViewed = useCallback((hos, resetIfComplete = false) => {
    const next = new Set(viewedIDsRef.current);
    next.add(hos.order);
    viewedIDsRef.current = next;
    setViewedIDs(next);
    if (resetIfComplete && next.size >= hosList.length) {
      resetViewed();
    }
  }, [resetViewed]);

  const reactionsFor = useCallback((hos) => reactions[hos.order] ?? [], [reactions]);

  const addReaction = useCallback((emoji, hos) => {
    setReactions((prev) => ({
      ...prev,
      [hos.order]: [...(prev[hos.order] ?? []), emoji],
    }));
  }, []);

  // Removes whichever reaction was added most recently, regardless of which kind it was. Drops
  // the entry for `hos` entirely once its last reaction is gone, rather than leaving an
  // empty array behind, so `reactionsFor` and a persisted-then-reloaded state agree on what "no
  // reactions" looks like.
  const removeLastReaction = useCallback((hos) => {
    setReactions((prev) => {
      const list = prev[hos.order];
      if (!list || list.length === 0) return prev;
      const next = { ...prev };
      if (list.length === 1) {
        delete next[hos.order];
      } else {
        next[hos.order] = list.slice(0, -1);
      }
      return next;
    });
  }, []);

  const imageZoomStateFor = useCallback((hos) => imageZoomStates[hos.order] ?? null, [imageZoomStates]);

  // Passing `null` clears the stored state (used once the image is back at 1x/no-offset, so a
  // "reset" HOS doesn't linger as a redundant entry) — same as Swift's `setImageZoomState`.
  const setImageZoomStateFor = useCallback((state, hos) => {
    setImageZoomStates((prev) => {
      if (state === null) {
        if (!(hos.order in prev)) return prev;
        const next = { ...prev };
        delete next[hos.order];
        return next;
      }
      return { ...prev, [hos.order]: state };
    });
  }, []);

  const drawingDisplayModeFor = useCallback(
    (hos) => drawingDisplayModes[hos.order] ?? DEFAULT_DRAWING_DISPLAY_MODE,
    [drawingDisplayModes],
  );

  // Choosing the default clears the stored entry, like `setImageZoomStateFor(null, ...)`.
  const setDrawingDisplayModeFor = useCallback((mode, hos) => {
    setDrawingDisplayModes((prev) => {
      if (mode === DEFAULT_DRAWING_DISPLAY_MODE) {
        if (!(hos.order in prev)) return prev;
        const next = { ...prev };
        delete next[hos.order];
        return next;
      }
      return { ...prev, [hos.order]: mode };
    });
  }, []);

  const drawingFor = useCallback((hos) => drawings[hos.order] ?? null, [drawings]);

  // Saves (or, with `null`, deletes) `hos`'s drawing. Unlike other state, this writes to
  // storage immediately rather than waiting for `persistNow`, same as Swift's
  // `setDrawingFileName`: a drawing is real user work, and a crash or killed tab before the page
  // is hidden shouldn't lose it.
  const setDrawingFor = useCallback((drawing, hos) => {
    if (drawing) {
      saveDrawing(hos.order, drawing);
    } else {
      deleteDrawing(hos.order);
    }
    setDrawings((prev) => {
      if (drawing) return { ...prev, [hos.order]: drawing };
      if (!(hos.order in prev)) return prev;
      const next = { ...prev };
      delete next[hos.order];
      return next;
    });
  }, []);

  // Port of AppModel.swift's `buildInfo`: `[cycleCount|bundleVersion]`, using this app's own
  // package.json version as the web analog of CFBundleVersion.
  const buildInfo = `[${cycleCount}|${appVersion}]`;

  // Port of `AppLandingView`'s `scenePhase` observer calling `persistState()` when the app
  // backgrounds: writes on the web equivalents (tab hidden, or navigating away/closing) rather
  // than on every mutation, so a slideshow ticking every 0.1s or a reaction pick doesn't each
  // cause a write — only leaving/hiding the page does.
  const persistNow = useCallback(() => {
    savePersistedState({
      slideIndex,
      screen,
      shuffledIndexes: shuffleRef.current,
      nextShuffleIndex: nextShuffleIndexRef.current,
      reactions,
      imageZoomStates,
      drawingDisplayModes,
    });
  }, [slideIndex, screen, reactions, imageZoomStates, drawingDisplayModes]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') persistNow();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', persistNow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', persistNow);
    };
  }, [persistNow]);

  const value = useMemo(
    () => ({
      hosList,
      viewedIDs,
      cycleCount,
      buildInfo,
      slideIndex,
      setSlideIndex,
      screen,
      setScreen,
      select,
      nextRandomHOS,
      markViewed,
      resetViewed,
      reactionsFor,
      addReaction,
      removeLastReaction,
      imageZoomStateFor,
      setImageZoomStateFor,
      drawingDisplayModeFor,
      setDrawingDisplayModeFor,
      drawingFor,
      setDrawingFor,
    }),
    [
      viewedIDs,
      cycleCount,
      buildInfo,
      slideIndex,
      screen,
      select,
      nextRandomHOS,
      markViewed,
      resetViewed,
      reactionsFor,
      addReaction,
      removeLastReaction,
      imageZoomStateFor,
      setImageZoomStateFor,
      drawingDisplayModeFor,
      setDrawingDisplayModeFor,
      drawingFor,
      setDrawingFor,
    ],
  );

  return <AppModelContext.Provider value={value}>{children}</AppModelContext.Provider>;
}

export function useAppModel() {
  const ctx = useContext(AppModelContext);
  if (!ctx) throw new Error('useAppModel must be used within an AppModelProvider');
  return ctx;
}
