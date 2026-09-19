import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAppModel } from './AppModelContext.jsx';
import { useNavigation } from '../navigation/NavigationContext.jsx';

const SlideshowContext = createContext(null);

const SLIDESHOW_INTERVAL_TENTHS = 50; // 5.0 seconds, matches HomeView.slideshowIntervalTenths

/**
 * Port of the slideshow timer that lives on HomeView in the SwiftUI app. Lifted to a
 * provider (rather than local state on the Home screen component) because our navigator only
 * mounts the single topmost screen at a time, whereas SwiftUI's NavigationStack keeps HomeView
 * mounted underneath whatever it has pushed — this context is what keeps the timer alive across
 * screen changes here instead.
 */
export function SlideshowProvider({ children }) {
  const { nextRandomPresident } = useAppModel();
  const { path, replaceWithDetail } = useNavigation();
  const [remainingTenths, setRemainingTenths] = useState(0);
  const timerRef = useRef(null);
  const isRunning = timerRef.current !== null;

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRemainingTenths(0);
  }, []);

  const tick = useCallback(() => {
    setRemainingTenths((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        replaceWithDetail(nextRandomPresident());
        return SLIDESHOW_INTERVAL_TENTHS;
      }
      return next;
    });
  }, [nextRandomPresident, replaceWithDetail]);

  const start = useCallback(() => {
    replaceWithDetail(nextRandomPresident());
    setRemainingTenths(SLIDESHOW_INTERVAL_TENTHS);
    timerRef.current = setInterval(tick, 100);
  }, [nextRandomPresident, replaceWithDetail, tick]);

  const toggle = useCallback(() => {
    if (isRunning) stop();
    else start();
  }, [isRunning, start, stop]);

  // Mirrors HomeView's `.onChange(of: path)`: leaving the stack entirely (back to Home) stops
  // the slideshow rather than leaving it running out of view.
  useEffect(() => {
    if (path.length === 0) stop();
  }, [path, stop]);

  useEffect(() => () => stop(), [stop]);

  const value = useMemo(
    () => ({ isRunning, remainingTenths, start, stop, toggle }),
    [isRunning, remainingTenths, start, stop, toggle],
  );

  return <SlideshowContext.Provider value={value}>{children}</SlideshowContext.Provider>;
}

export function useSlideshow() {
  const ctx = useContext(SlideshowContext);
  if (!ctx) throw new Error('useSlideshow must be used within a SlideshowProvider');
  return ctx;
}
