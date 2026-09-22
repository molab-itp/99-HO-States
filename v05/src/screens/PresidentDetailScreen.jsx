import { useEffect, useRef, useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import { wikipediaArticleURL } from '../data/wikipedia.js';
import { assetUrl } from '../data/assetUrl.js';
import NavBar from '../components/NavBar.jsx';
import ViewedProgressBar from '../components/ViewedProgressBar.jsx';
import Icon from '../components/Icon.jsx';

const DETAIL_REVEAL_DELAY_MS = 2000; // matches Swift's `delaySecs`
const SLIDESHOW_INTERVAL_TENTHS = 50; // 5.0 seconds, matches PresidentDetailView's slideshowIntervalTenths

/**
 * Port of PresidentDetailView.swift. `selected` is the president this screen was pushed with.
 * `startSlideshow`/`isRandomMode` are only set when Home's Start Slideshow button pushed this
 * screen; the slideshow's timer, pause state, and (in random mode) its random-walk history all
 * live here for the screen's whole lifetime — the app no longer swaps in a fresh detail screen on
 * every tick, so Previous/Next/pause can all act on the same instance's state.
 */
export default function PresidentDetailScreen({ selected, startSlideshow = false, isRandomMode = false }) {
  const { presidents, viewedIDs, buildInfo, markViewed, nextRandomPresident, setSlideIndex } = useAppModel();

  const startIndex = (() => {
    const found = presidents.findIndex((p) => p.order === selected.order);
    return found >= 0 ? found : 0;
  })();

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [isSlideshowActive] = useState(startSlideshow);
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(false);
  const [remainingTenths, setRemainingTenths] = useState(SLIDESHOW_INTERVAL_TENTHS);

  // `index` (which president is shown) and, in random mode, the walk's history/position all
  // change together, so they're one state object updated atomically.
  const [nav, setNav] = useState({ index: startIndex, history: [startIndex], position: 0 });
  const index = nav.index;
  const president = presidents[index];
  const isFirst = index === 0;
  const isLast = index === presidents.length - 1;

  // Mirrors `.task(id: index)`: mark viewed immediately, then fade the text in after a delay
  // that's cancelled (never revealed) if `index` changes again first.
  useEffect(() => {
    let cancelled = false;
    markViewed(president, isSlideshowActive);
    setDetailsVisible(false);
    const timer = setTimeout(() => {
      if (!cancelled) setDetailsVisible(true);
    }, DETAIL_REVEAL_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Mirrors `index` into `appModel.slideIndex` on every change (including the initial mount), so
  // it persists across this screen being unmounted and remounted — e.g. a sequential slideshow
  // that's stopped and later restarted resumes from here instead of always restarting at #1.
  useEffect(() => {
    setSlideIndex(index);
  }, [index, setSlideIndex]);

  function advanceForward(prevNav) {
    if (isRandomMode) {
      if (prevNav.position < prevNav.history.length - 1) {
        const position = prevNav.position + 1;
        return { ...prevNav, index: prevNav.history[position], position };
      }
      const next = nextRandomPresident();
      const newIndex = next ? presidents.findIndex((p) => p.order === next.order) : -1;
      if (newIndex < 0) return prevNav;
      const history = [...prevNav.history, newIndex];
      return { index: newIndex, history, position: history.length - 1 };
    }
    const newIndex = prevNav.index === presidents.length - 1 ? 0 : prevNav.index + 1;
    return { ...prevNav, index: newIndex };
  }

  function stepBackward(prevNav) {
    if (isRandomMode) {
      if (prevNav.position === 0) return prevNav;
      const position = prevNav.position - 1;
      return { ...prevNav, index: prevNav.history[position], position };
    }
    const newIndex = prevNav.index === 0 ? presidents.length - 1 : prevNav.index - 1;
    return { ...prevNav, index: newIndex };
  }

  // Auto-advance timer: only runs while a slideshow is active, uses a ref for the tick body so
  // the interval (set up once) always calls the latest closure instead of a stale one. The
  // updater is kept pure (just clamped decrement, no side effects) — React 18 StrictMode
  // intentionally double-invokes functional state updaters to catch impure ones, and an earlier
  // version of this that called `setNav(...)` from inside here had that side effect fire twice
  // per tick, advancing the slideshow by 2 presidents instead of 1.
  const tickRef = useRef(() => {});
  tickRef.current = () => {
    if (isSlideshowPaused) return;
    setRemainingTenths((prev) => Math.max(0, prev - 1));
  };

  useEffect(() => {
    if (!isSlideshowActive) return undefined;
    const id = setInterval(() => tickRef.current(), 100);
    return () => clearInterval(id);
  }, [isSlideshowActive]);

  // Advances exactly once each time the countdown reaches zero. A plain `useEffect` keyed on the
  // resulting value only reacts to genuine changes (unlike a functional updater, which StrictMode
  // double-invokes), so this can't double-fire the way the inline version above did.
  useEffect(() => {
    if (!isSlideshowActive || remainingTenths > 0) return;
    setNav((prevNav) => advanceForward(prevNav));
    setRemainingTenths(SLIDESHOW_INTERVAL_TENTHS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingTenths, isSlideshowActive]);

  function goToPrevious() {
    if (isSlideshowActive) {
      setNav((prevNav) => stepBackward(prevNav));
      setRemainingTenths(SLIDESHOW_INTERVAL_TENTHS);
    } else if (!isFirst) {
      setNav((prevNav) => ({ ...prevNav, index: prevNav.index - 1 }));
    }
  }

  function goToNext() {
    if (isSlideshowActive) {
      setNav((prevNav) => advanceForward(prevNav));
      setRemainingTenths(SLIDESHOW_INTERVAL_TENTHS);
    } else if (!isLast) {
      setNav((prevNav) => ({ ...prevNav, index: prevNav.index + 1 }));
    }
  }

  // Manual jump when no slideshow is running (independent of the Random Mode checkbox, which
  // only affects Next/Previous once a slideshow is active).
  function goToRandom() {
    const next = nextRandomPresident();
    if (!next) return;
    const newIndex = presidents.findIndex((p) => p.order === next.order);
    if (newIndex >= 0) setNav((prevNav) => ({ ...prevNav, index: newIndex }));
  }

  const orderText = String(president.order).padStart(2, '0');
  const title = isSlideshowActive
    ? `#${orderText} · ${(remainingTenths / 10).toFixed(1).padStart(4, '0')}s ${buildInfo}`
    : `#${orderText} ${buildInfo}`;

  const imageSrc = president.large || president.thumbnail;
  const articleURL = wikipediaArticleURL(president);

  const isPreviousDisabled = isSlideshowActive ? isRandomMode && nav.position === 0 : isFirst;
  const isNextDisabled = isSlideshowActive ? false : isLast;

  return (
    <div className="screen-scroll">
      <NavBar title={title} monospace />
      <div className="detail">
        <ViewedProgressBar total={presidents.length} viewedIDs={viewedIDs} />

        {imageSrc ? (
          <img className="detail-image" src={assetUrl(imageSrc)} alt={president.name} />
        ) : (
          <div className="detail-image-placeholder">
            <Icon name="person-circle" size={64} />
          </div>
        )}

        <div className={detailsVisible ? 'detail-text visible' : 'detail-text'}>
          <h1 className="name-mono">
            #{president.order} {president.name}
          </h1>
          <p className="subtitle">
            {president.term} · {president.party}
          </p>
          <p>{president.extract}</p>
          {articleURL && (
            <a className="wiki-link" href={articleURL} target="_blank" rel="noopener noreferrer">
              <Icon name="book" size={14} />
              Read on Wikipedia
            </a>
          )}
        </div>
      </div>

      <div className="detail-toolbar">
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label="Previous"
          disabled={isPreviousDisabled}
          onClick={goToPrevious}
        >
          <Icon name="chevron-left" size={20} />
        </button>
        {isSlideshowActive ? (
          <button
            className="toolbar-btn toolbar-btn-icon"
            aria-label={isSlideshowPaused ? 'Play' : 'Pause'}
            onClick={() => setIsSlideshowPaused((p) => !p)}
          >
            <Icon name={isSlideshowPaused ? 'play-circle-fill' : 'pause-circle-fill'} size={19} />
          </button>
        ) : (
          <button className="toolbar-btn toolbar-btn-icon" aria-label="Random" onClick={goToRandom}>
            <Icon name="shuffle" size={19} />
          </button>
        )}
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label="Next"
          disabled={isNextDisabled}
          onClick={goToNext}
        >
          <Icon name="chevron-right" size={20} />
        </button>
      </div>
    </div>
  );
}
