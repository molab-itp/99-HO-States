import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import presidents from '../data/presidents.js';

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
  const drawPositionRef = useRef(0);
  const [viewedIDs, setViewedIDs] = useState(() => new Set());

  const nextRandomPresident = useCallback(() => {
    if (presidents.length === 0) return null;

    if (drawPositionRef.current >= shuffleRef.current.length) {
      const lastDrawnIndex = shuffleRef.current[shuffleRef.current.length - 1];
      shuffleRef.current = shuffledIndexes(presidents.length);
      if (presidents.length > 1 && shuffleRef.current[0] === lastDrawnIndex) {
        [shuffleRef.current[0], shuffleRef.current[1]] = [shuffleRef.current[1], shuffleRef.current[0]];
      }
      drawPositionRef.current = 0;
    }

    const president = presidents[shuffleRef.current[drawPositionRef.current]];
    drawPositionRef.current += 1;
    return president;
  }, []);

  const markViewed = useCallback((president, resetIfComplete = false) => {
    setViewedIDs((prev) => {
      const next = new Set(prev);
      next.add(president.order);
      if (resetIfComplete && next.size >= presidents.length) {
        return new Set();
      }
      return next;
    });
  }, []);

  const resetViewed = useCallback(() => setViewedIDs(new Set()), []);

  const value = useMemo(
    () => ({ presidents, viewedIDs, nextRandomPresident, markViewed, resetViewed }),
    [viewedIDs, nextRandomPresident, markViewed, resetViewed],
  );

  return <AppModelContext.Provider value={value}>{children}</AppModelContext.Provider>;
}

export function useAppModel() {
  const ctx = useContext(AppModelContext);
  if (!ctx) throw new Error('useAppModel must be used within an AppModelProvider');
  return ctx;
}
