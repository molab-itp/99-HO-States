import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import presidents from '../data/presidents.js';
import { version as appVersion } from '../../package.json';
import { loadPersistedState, savePersistedState } from '../data/persistedState.js';
import { normalizeReactions } from '../data/presidentReaction.js';
import { deleteDrawing, loadAllDrawings, saveDrawing } from '../data/presidentDrawingStore.js';

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
 * Port of AppModel.swift. Owns the loaded president list and a shuffled draw order used by
 * every "Random" control, so random selection cycles through the full set before repeating
 * instead of drawing independently each time. Also tracks which presidents have been viewed,
 * driving the progress bar on the detail screen and the "left to see" count on Home.
 */
export function AppModelProvider({ children }) {
  // Loaded once per provider mount — a stand-in for `AppModel.init`'s `loadPersistedState()`.
  // Guards against a stale entry left over from a build with a different president count (e.g.
  // after adding/removing entries) producing an out-of-range index, same as the Swift version.
  const persistedRef = useRef(undefined);
  if (persistedRef.current === undefined) {
    const persisted = loadPersistedState();
    persistedRef.current =
      persisted && Array.isArray(persisted.shuffledIndexes) && persisted.shuffledIndexes.length === presidents.length
        ? persisted
        : null;
  }
  const persisted = persistedRef.current;

  const shuffleRef = useRef(persisted ? persisted.shuffledIndexes : shuffledIndexes(presidents.length));
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

  // Which president `PresidentDetailScreen` is currently showing, as an index into `presidents`.
  // Lives here (rather than only as local state on the screen) so it survives that screen being
  // unmounted and remounted — e.g. a non-random slideshow that's stopped and later restarted
  // picks up from this index instead of always restarting at the first president.
  const [slideIndex, setSlideIndex] = useState(() =>
    persisted && presidents[persisted.slideIndex] ? persisted.slideIndex : 0,
  );

  // User-picked feedback and per-president pinch-zoom/pan state, keyed by `president.order`.
  // Ported from `AppModel.swift`'s `reactions`/`imageZoomStates`.
  const [reactions, setReactions] = useState(() => normalizeReactions(persisted?.reactions));
  const [imageZoomStates, setImageZoomStates] = useState(() => persisted?.imageZoomStates ?? {});

  // Each president's saved photo drawing (see `presidentDrawingStore.js`), overlaid on the
  // portrait by `ZoomableHeaderImage`. Ported from `AppModel.swift`'s `drawingFileNames`, except
  // the strokes themselves are held here rather than a file name pointing at a PNG.
  const [drawings, setDrawings] = useState(() => loadAllDrawings(presidents));

  const nextRandomPresident = useCallback(() => {
    if (presidents.length === 0) return null;

    if (nextShuffleIndexRef.current >= shuffleRef.current.length) {
      nextShuffleIndexRef.current = 0;
    }

    const president = presidents[shuffleRef.current[nextShuffleIndexRef.current]];
    nextShuffleIndexRef.current += 1;
    return president;
  }, []);

  // Deals a fresh shuffle and rewinds the sequential slideshow back to the first president. This
  // is the only place the random draw order is ever reshuffled — `nextRandomPresident()` just
  // walks (and wraps within) whatever permutation was last dealt here.
  const reshuffle = useCallback(() => {
    shuffleRef.current = shuffledIndexes(presidents.length);
    nextShuffleIndexRef.current = 0;
    setCycleCount((c) => c + 1);
    setSlideIndex(0);
  }, []);

  const resetViewed = useCallback(() => {
    viewedIDsRef.current = new Set();
    setViewedIDs(new Set());
    reshuffle();
  }, [reshuffle]);

  const markViewed = useCallback((president, resetIfComplete = false) => {
    const next = new Set(viewedIDsRef.current);
    next.add(president.order);
    viewedIDsRef.current = next;
    setViewedIDs(next);
    if (resetIfComplete && next.size >= presidents.length) {
      resetViewed();
    }
  }, [resetViewed]);

  const reactionsFor = useCallback((president) => reactions[president.order] ?? [], [reactions]);

  const addReaction = useCallback((emoji, president) => {
    setReactions((prev) => ({
      ...prev,
      [president.order]: [...(prev[president.order] ?? []), emoji],
    }));
  }, []);

  // Removes whichever reaction was added most recently, regardless of which kind it was. Drops
  // the entry for `president` entirely once its last reaction is gone, rather than leaving an
  // empty array behind, so `reactionsFor` and a persisted-then-reloaded state agree on what "no
  // reactions" looks like.
  const removeLastReaction = useCallback((president) => {
    setReactions((prev) => {
      const list = prev[president.order];
      if (!list || list.length === 0) return prev;
      const next = { ...prev };
      if (list.length === 1) {
        delete next[president.order];
      } else {
        next[president.order] = list.slice(0, -1);
      }
      return next;
    });
  }, []);

  const imageZoomStateFor = useCallback((president) => imageZoomStates[president.order] ?? null, [imageZoomStates]);

  // Passing `null` clears the stored state (used once the image is back at 1x/no-offset, so a
  // "reset" president doesn't linger as a redundant entry) — same as Swift's `setImageZoomState`.
  const setImageZoomStateFor = useCallback((state, president) => {
    setImageZoomStates((prev) => {
      if (state === null) {
        if (!(president.order in prev)) return prev;
        const next = { ...prev };
        delete next[president.order];
        return next;
      }
      return { ...prev, [president.order]: state };
    });
  }, []);

  const drawingFor = useCallback((president) => drawings[president.order] ?? null, [drawings]);

  // Saves (or, with `null`, deletes) `president`'s drawing. Unlike other state, this writes to
  // storage immediately rather than waiting for `persistNow`, same as Swift's
  // `setDrawingFileName`: a drawing is real user work, and a crash or killed tab before the page
  // is hidden shouldn't lose it.
  const setDrawingFor = useCallback((drawing, president) => {
    if (drawing) {
      saveDrawing(president.order, drawing);
    } else {
      deleteDrawing(president.order);
    }
    setDrawings((prev) => {
      if (drawing) return { ...prev, [president.order]: drawing };
      if (!(president.order in prev)) return prev;
      const next = { ...prev };
      delete next[president.order];
      return next;
    });
  }, []);

  // Port of AppModel.swift's `buildInfo`: `[cycleCount|bundleVersion]`, using this app's own
  // package.json version as the web analog of CFBundleVersion.
  const buildInfo = `[${cycleCount}|${appVersion}]`;

  // Port of `HO_States_US_App`'s `scenePhase` observer calling `persistState()` when the app
  // backgrounds: writes on the web equivalents (tab hidden, or navigating away/closing) rather
  // than on every mutation, so a slideshow ticking every 0.1s or a reaction pick doesn't each
  // cause a write — only leaving/hiding the page does.
  const persistNow = useCallback(() => {
    savePersistedState({
      slideIndex,
      shuffledIndexes: shuffleRef.current,
      nextShuffleIndex: nextShuffleIndexRef.current,
      reactions,
      imageZoomStates,
    });
  }, [slideIndex, reactions, imageZoomStates]);

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
      presidents,
      viewedIDs,
      cycleCount,
      buildInfo,
      slideIndex,
      setSlideIndex,
      nextRandomPresident,
      markViewed,
      resetViewed,
      reactionsFor,
      addReaction,
      removeLastReaction,
      imageZoomStateFor,
      setImageZoomStateFor,
      drawingFor,
      setDrawingFor,
    }),
    [
      viewedIDs,
      cycleCount,
      buildInfo,
      slideIndex,
      nextRandomPresident,
      markViewed,
      resetViewed,
      reactionsFor,
      addReaction,
      removeLastReaction,
      imageZoomStateFor,
      setImageZoomStateFor,
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
