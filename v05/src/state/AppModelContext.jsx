import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import presidents from '../data/presidents.js';
import { version as appVersion } from '../../package.json';

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
  const shuffleRef = useRef(shuffledIndexes(presidents.length));
  // Walks `shuffleRef` in order, wrapping back to 0 once every index has been served. The
  // permutation itself is only ever redealt by `resetViewed()` (via `reshuffle()` below) — never
  // here — so resuming a random-mode slideshow just continues walking the same order instead of
  // starting a fresh one.
  const nextShuffleIndexRef = useRef(0);
  const viewedIDsRef = useRef(new Set());
  const [viewedIDs, setViewedIDs] = useState(() => new Set());

  // Number of times the shuffle has been (re)dealt — the initial deal plus every reshuffle from
  // `resetViewed()` — so `buildInfo` can tell how many full random cycles have been dealt.
  const [cycleCount, setCycleCount] = useState(1);

  // Which president `PresidentDetailScreen` is currently showing, as an index into `presidents`.
  // Lives here (rather than only as local state on the screen) so it survives that screen being
  // unmounted and remounted — e.g. a non-random slideshow that's stopped and later restarted
  // picks up from this index instead of always restarting at the first president.
  const [slideIndex, setSlideIndex] = useState(0);

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

  // Port of AppModel.swift's `buildInfo`: `[cycleCount|bundleVersion]`, using this app's own
  // package.json version as the web analog of CFBundleVersion.
  const buildInfo = `[${cycleCount}|${appVersion}]`;

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
    }),
    [viewedIDs, cycleCount, buildInfo, slideIndex, nextRandomPresident, markViewed, resetViewed],
  );

  return <AppModelContext.Provider value={value}>{children}</AppModelContext.Provider>;
}

export function useAppModel() {
  const ctx = useContext(AppModelContext);
  if (!ctx) throw new Error('useAppModel must be used within an AppModelProvider');
  return ctx;
}
