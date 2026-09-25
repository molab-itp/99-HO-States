import { useEffect, useRef, useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import { wikipediaArticleURL } from '../data/wikipedia.js';
import { assetUrl } from '../data/assetUrl.js';
import NavBar from '../components/NavBar.jsx';
import ViewedProgressBar from '../components/ViewedProgressBar.jsx';
import ZoomableHeaderImage from '../components/ZoomableHeaderImage.jsx';
import ReactionControl from '../components/ReactionControl.jsx';
import Icon from '../components/Icon.jsx';
import PresidentDrawingEditor from '../components/PresidentDrawingEditor.jsx';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredNumber } from '../state/useStoredNumber.js';
import { SlideshowSettings } from '../state/slideshowSettings.js';

const SLIDESHOW_TICK_SECS = 0.1; // matches PresidentDetailView's slideshowTickSecs

/**
 * Port of PresidentDetailView.swift. `selected` is the president this screen was pushed with.
 * `startSlideshow`/`isRandomMode` are only set when Home's Start Slideshow button pushed this
 * screen; the slideshow's timer, pause state, and (in random mode) its random-walk history all
 * live here for the screen's whole lifetime — the app no longer swaps in a fresh detail screen on
 * every tick, so Previous/Next/pause can all act on the same instance's state.
 */
export default function PresidentDetailScreen({ selected, startSlideshow = false, isRandomMode = false }) {
  const {
    presidents,
    viewedIDs,
    buildInfo,
    markViewed,
    nextRandomPresident,
    setSlideIndex,
    reactionsFor,
    addReaction,
    removeLastReaction,
    imageZoomStateFor,
    setImageZoomStateFor,
    drawingFor,
    setDrawingFor,
  } = useAppModel();

  const startIndex = (() => {
    const found = presidents.findIndex((p) => p.order === selected.order);
    return found >= 0 ? found : 0;
  })();

  // Chosen on Home; read-only here. Seconds to wait before fading in the details is the interval
  // times the chosen fraction, matching Swift's computed `delaySecs`.
  const [slideshowIntervalSecs] = useStoredNumber(
    SlideshowSettings.intervalSecsKey,
    SlideshowSettings.defaultIntervalSecs,
  );
  const [delayFraction] = useStoredNumber(
    SlideshowSettings.delayFractionKey,
    SlideshowSettings.defaultDelayFraction,
  );
  const delaySecs = slideshowIntervalSecs * delayFraction;
  const [fadePeriod] = useStoredNumber(SlideshowSettings.fadePeriodKey, SlideshowSettings.defaultFadePeriod);

  // The index whose details have been revealed. Derived rather than a boolean reset in the effect
  // below, so a new president's text is hidden in the same render that shows it — an effect runs
  // after paint, which let the new text flash at full opacity first.
  const [revealedIndex, setRevealedIndex] = useState(null);
  const [isSlideshowActive] = useState(startSlideshow);
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(false);
  const [remainingSecs, setRemainingSecs] = useState(slideshowIntervalSecs);
  const [isDrawingEditorOpen, setIsDrawingEditorOpen] = useState(false);
  // Port of `@AppStorage("showsDrawings")`: shared across presidents and reloads, so hiding
  // drawings stays in effect while browsing.
  const [showsDrawings, setShowsDrawings] = useStoredBoolean('ho-states-us.showsDrawings', true);

  // `index` (which president is shown) and, in random mode, the walk's history/position all
  // change together, so they're one state object updated atomically.
  const [nav, setNav] = useState({ index: startIndex, history: [startIndex], position: 0 });
  const index = nav.index;
  const president = presidents[index];
  const isFirst = index === 0;
  const isLast = index === presidents.length - 1;
  const detailsVisible = revealedIndex === index;

  // Mirrors `.task(id: index)`: mark viewed immediately, then fade the text in after a delay
  // that's cancelled (never revealed) if `index` changes again first.
  useEffect(() => {
    let cancelled = false;
    markViewed(president, isSlideshowActive);
    const timer = setTimeout(() => {
      if (!cancelled) setRevealedIndex(index);
    }, delaySecs * 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Port of the Swift ZStack + `.transition(.opacity)`: while a slideshow runs, the previous
  // president's image stays on top of the new one and fades out over `fadePeriod` as the new one
  // fades in. Manual browsing (no slideshow) swaps the image instantly. The switch is made during
  // render (not in an effect) so the outgoing image's layer is never unmounted, not even for one
  // commit: remounting it made a fresh <img> that flashed blank while the browser decoded it.
  const [fade, setFade] = useState({ shown: president, outgoing: null });
  if (fade.shown.order !== president.order) {
    setFade({ shown: president, outgoing: isSlideshowActive ? fade.shown : null });
  }
  const outgoing = fade.outgoing;
  useEffect(() => {
    if (!outgoing) return undefined;
    const timer = setTimeout(() => setFade((f) => ({ ...f, outgoing: null })), fadePeriod * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing]);

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
  // The drawing editor also holds the countdown, so the president can't change mid-drawing — the
  // equivalent of the Swift editor push firing `onDisappear` and stopping the timer.
  tickRef.current = () => {
    if (isSlideshowPaused || isDrawingEditorOpen) return;
    setRemainingSecs((prev) => Math.max(0, prev - SLIDESHOW_TICK_SECS));
  };

  useEffect(() => {
    if (!isSlideshowActive) return undefined;
    const id = setInterval(() => tickRef.current(), SLIDESHOW_TICK_SECS * 1000);
    return () => clearInterval(id);
  }, [isSlideshowActive]);

  // Advances exactly once each time the countdown reaches zero. A plain `useEffect` keyed on the
  // resulting value only reacts to genuine changes (unlike a functional updater, which StrictMode
  // double-invokes), so this can't double-fire the way the inline version above did. Half-tick
  // tolerance absorbs floating-point drift from repeated subtraction.
  useEffect(() => {
    if (!isSlideshowActive || remainingSecs >= SLIDESHOW_TICK_SECS / 2) return;
    setNav((prevNav) => advanceForward(prevNav));
    setRemainingSecs(slideshowIntervalSecs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSecs, isSlideshowActive]);

  function goToPrevious() {
    if (isSlideshowActive) {
      setNav((prevNav) => stepBackward(prevNav));
      setRemainingSecs(slideshowIntervalSecs);
    } else if (!isFirst) {
      setNav((prevNav) => ({ ...prevNav, index: prevNav.index - 1 }));
    }
  }

  function goToNext() {
    if (isSlideshowActive) {
      setNav((prevNav) => advanceForward(prevNav));
      setRemainingSecs(slideshowIntervalSecs);
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
    ? `#${orderText} · ${remainingSecs.toFixed(1).padStart(4, '0')}s ${buildInfo}`
    : `#${orderText} ${buildInfo}`;

  const imageSrc = president.large || president.thumbnail;
  const drawing = drawingFor(president);
  const articleURL = wikipediaArticleURL(president);

  const isPreviousDisabled = isSlideshowActive ? isRandomMode && nav.position === 0 : isFirst;
  const isNextDisabled = isSlideshowActive ? false : isLast;

  return (
    <div className="screen-scroll">
      <NavBar
        title={title}
        monospace
        trailing={
          <>
            {drawing && (
              <button
                className="nav-action"
                aria-label={showsDrawings ? 'Hide Drawing' : 'Show Drawing'}
                onClick={() => setShowsDrawings(!showsDrawings)}
              >
                <Icon name={showsDrawings ? 'eye' : 'eye-slash'} size={19} />
              </button>
            )}
            <button className="nav-action" aria-label="Draw on Photo" onClick={() => setIsDrawingEditorOpen(true)}>
              <Icon name="pencil-square" size={18} />
            </button>
          </>
        }
      />
      <div className="detail">
        <ViewedProgressBar total={presidents.length} viewedIDs={viewedIDs} />

        <div className="header-fade" style={{ '--fade-period': `${fadePeriod}s` }}>
          {/* Both layers are keyed by president, so when the current one becomes the outgoing one
              React keeps its DOM (and its already-decoded <img>). The outgoing layer comes first
              so the incoming one is appended after it rather than moving it; z-index puts the
              outgoing one on top. A fresh key per president also resets zoom/pan state. */}
          {[outgoing, president].filter(Boolean).map((p) => {
            const isOutgoing = p === outgoing;
            const src = p.large || p.thumbnail;
            const layerDrawing = drawingFor(p);
            let className = 'fade-layer';
            if (isOutgoing) className += ' fade-out';
            else if (outgoing) className += ' fade-in';
            return (
              <div key={p.order} className={className} aria-hidden={isOutgoing || undefined}>
                <ZoomableHeaderImage
                  imageSrc={src ? assetUrl(src) : null}
                  alt={p.name}
                  initialZoom={imageZoomStateFor(p)}
                  onZoomChange={isOutgoing ? undefined : (state) => setImageZoomStateFor(state, p)}
                  drawing={showsDrawings ? layerDrawing : null}
                />
              </div>
            );
          })}
        </div>

        <div className={detailsVisible ? 'detail-text visible' : 'detail-text'}>
          <h1 className="name-mono">
            #{president.order} {president.name}
          </h1>
          <ReactionControl
            reactions={reactionsFor(president)}
            onAdd={(emoji) => addReaction(emoji, president)}
            onRemoveLast={() => removeLastReaction(president)}
          />
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

      {isDrawingEditorOpen && (
        <PresidentDrawingEditor
          president={president}
          imageSrc={imageSrc ? assetUrl(imageSrc) : null}
          initialDrawing={drawing}
          onClose={(result) => {
            setIsDrawingEditorOpen(false);
            if (result !== undefined) setDrawingFor(result, president);
          }}
        />
      )}
    </div>
  );
}
