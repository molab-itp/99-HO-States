import { useEffect, useRef, useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import { wikipediaArticleURL } from '../data/wikipedia.js';
import { assetUrl } from '../data/assetUrl.js';
import NavBar from '../components/NavBar.jsx';
import ViewedProgressBar from '../components/ViewedProgressBar.jsx';
import ZoomableHeaderImage from '../components/ZoomableHeaderImage.jsx';
import Icon from '../components/Icon.jsx';
import PresidentDrawingEditor from '../components/PresidentDrawingEditor.jsx';
import SettingsScreen from './SettingsScreen.jsx';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredNumber } from '../state/useStoredNumber.js';
import { SlideshowSettings } from '../state/slideshowSettings.js';

const SLIDESHOW_TICK_SECS = 0.1; // matches PresidentDetailView's slideshowTickSecs

/**
 * Port of PresidentDetailView.swift — the app's start screen. `selected` is the president shown
 * at launch. The slideshow is always "on": Play/Pause just toggles whether its countdown
 * advances, and it starts paused so launching lands on a still president until Play is pressed.
 * Settings (list, Random Head, slideshow options) is a sheet opened from the info button.
 */
export default function PresidentDetailScreen({ selected }) {
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

  // Chosen in Settings; read-only here. Seconds to wait before fading in the details is the interval
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
  const [isRandomMode] = useStoredBoolean(SlideshowSettings.randomModeKey, SlideshowSettings.defaultRandomMode);
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(true);
  const isPlaying = !isSlideshowPaused;
  const [remainingSecs, setRemainingSecs] = useState(slideshowIntervalSecs);
  const [isDrawingEditorOpen, setIsDrawingEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Port of `@AppStorage("showsDrawings")`: shared across presidents and reloads, so hiding
  // drawings stays in effect while browsing.
  const [showsDrawings, setShowsDrawings] = useStoredBoolean('ho-states-us.showsDrawings', true);

  // `index` (which president is shown) and, in random mode, the walk's history/position all
  // change together, so they're one state object updated atomically. The history restarts
  // whenever Settings picks a president.
  const [nav, setNav] = useState({ index: startIndex, history: [startIndex], position: 0 });
  const index = nav.index;
  const president = presidents[index];
  const detailsVisible = revealedIndex === index;

  // Mirrors `.task(id: index)`: mark viewed immediately, then fade the text in after a delay
  // that's cancelled (never revealed) if `index` changes again first.
  useEffect(() => {
    let cancelled = false;
    markViewed(president, isPlaying);
    const timer = setTimeout(() => {
      if (!cancelled) setRevealedIndex(index);
    }, delaySecs * 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Port of the Swift ZStack + `.transition(.opacity)`: while the slideshow plays, the previous
  // president's image stays on top of the new one and fades out over `fadePeriod` as the new one
  // fades in. Manual browsing (while paused) swaps the image instantly. The switch is made during
  // render (not in an effect) so the outgoing image's layer is never unmounted, not even for one
  // commit: remounting it made a fresh <img> that flashed blank while the browser decoded it.
  const [fade, setFade] = useState({ shown: president, outgoing: null });
  if (fade.shown.order !== president.order) {
    setFade({ shown: president, outgoing: isPlaying ? fade.shown : null });
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
  // e.g. a reload resumes at the president last shown instead of always restarting at #1.
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

  // Auto-advance timer: always running (ticks are ignored while paused), uses a ref for the tick body so
  // the interval (set up once) always calls the latest closure instead of a stale one. The
  // updater is kept pure (just clamped decrement, no side effects) — React 18 StrictMode
  // intentionally double-invokes functional state updaters to catch impure ones, and an earlier
  // version of this that called `setNav(...)` from inside here had that side effect fire twice
  // per tick, advancing the slideshow by 2 presidents instead of 1.
  const tickRef = useRef(() => {});
  // The drawing editor and Settings also hold the countdown, so the president can't change
  // mid-drawing or behind the sheet — matching the Swift `onDisappear` / `isSettingsPresented`
  // checks.
  tickRef.current = () => {
    if (!isPlaying || isDrawingEditorOpen || isSettingsOpen) return;
    setRemainingSecs((prev) => Math.max(0, prev - SLIDESHOW_TICK_SECS));
  };

  useEffect(() => {
    const id = setInterval(() => tickRef.current(), SLIDESHOW_TICK_SECS * 1000);
    return () => clearInterval(id);
  }, []);

  // Advances exactly once each time the countdown reaches zero. A plain `useEffect` keyed on the
  // resulting value only reacts to genuine changes (unlike a functional updater, which StrictMode
  // double-invokes), so this can't double-fire the way the inline version above did. Half-tick
  // tolerance absorbs floating-point drift from repeated subtraction.
  useEffect(() => {
    if (remainingSecs >= SLIDESHOW_TICK_SECS / 2) return;
    setNav((prevNav) => advanceForward(prevNav));
    setRemainingSecs(slideshowIntervalSecs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSecs]);

  function goToPrevious() {
    setNav((prevNav) => stepBackward(prevNav));
    setRemainingSecs(slideshowIntervalSecs);
  }

  function goToNext() {
    setNav((prevNav) => advanceForward(prevNav));
    setRemainingSecs(slideshowIntervalSecs);
  }

  /** Shows a president picked in Settings (from the list or Random Head), starting a fresh
   *  random-walk history from it. */
  function showFromSettings(picked) {
    const newIndex = presidents.findIndex((p) => p.order === picked.order);
    if (newIndex < 0) return;
    setNav({ index: newIndex, history: [newIndex], position: 0 });
    setRemainingSecs(slideshowIntervalSecs);
  }

  function startSlideshow() {
    setIsSlideshowPaused(false);
    setRemainingSecs(slideshowIntervalSecs);
  }

  const orderText = String(president.order).padStart(2, '0');
  const title = isPlaying
    ? `#${orderText} · ${remainingSecs.toFixed(1).padStart(4, '0')}s ${buildInfo}`
    : `#${orderText} ${buildInfo}`;

  const imageSrc = president.large || president.thumbnail;
  const drawing = drawingFor(president);
  const articleURL = wikipediaArticleURL(president);

  const isPreviousDisabled = isRandomMode && nav.position === 0;

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
            <button className="nav-action" aria-label="Settings" onClick={() => setIsSettingsOpen(true)}>
              <Icon name="info-circle" size={19} />
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
                  reactions={reactionsFor(p)}
                  showsZoomControls={!isPlaying}
                />
              </div>
            );
          })}
        </div>

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
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label={isSlideshowPaused ? 'Play' : 'Pause'}
          onClick={() => setIsSlideshowPaused((p) => !p)}
        >
          <Icon name={isSlideshowPaused ? 'play-circle-fill' : 'pause-circle-fill'} size={19} />
        </button>
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label="Next"
          onClick={goToNext}
        >
          <Icon name="chevron-right" size={20} />
        </button>
      </div>

      {isSettingsOpen && (
        <SettingsScreen
          onSelect={showFromSettings}
          onStartSlideshow={startSlideshow}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isDrawingEditorOpen && (
        <PresidentDrawingEditor
          president={president}
          imageSrc={imageSrc ? assetUrl(imageSrc) : null}
          initialDrawing={drawing}
          reactions={reactionsFor(president)}
          onAddReaction={(emoji) => addReaction(emoji, president)}
          onRemoveLastReaction={() => removeLastReaction(president)}
          onClose={(result) => {
            setIsDrawingEditorOpen(false);
            if (result !== undefined) setDrawingFor(result, president);
          }}
        />
      )}
    </div>
  );
}
