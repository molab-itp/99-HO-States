import { useEffect, useRef, useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import { wikipediaArticleURL } from '../data/wikipedia.js';
import { assetUrl } from '../data/assetUrl.js';
import NavBar from '../components/NavBar.jsx';
import ViewedProgressBar from '../components/ViewedProgressBar.jsx';
import ZoomableHeaderImage from '../components/ZoomableHeaderImage.jsx';
import Icon from '../components/Icon.jsx';
import HOSDrawingEditor from '../components/HOSDrawingEditor.jsx';
import DrawingDisplayMenu from '../components/DrawingDisplayMenu.jsx';
import { showsDrawing, showsPhoto } from '../data/drawingDisplayMode.js';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredNumber } from '../state/useStoredNumber.js';
import { SlideshowSettings } from '../state/slideshowSettings.js';

const SLIDESHOW_TICK_SECS = 0.1; // matches HOSDetailView's slideshowTickSecs

/**
 * Port of HOSDetailView.swift. `selected` is the HOS shown when the screen opens (pushed from
 * Landing or the list, or restored on reload). The slideshow is always "on": Play/Pause just
 * toggles whether its countdown advances. It starts paused unless `startsPlaying` is set
 * (Landing's Start Slideshow), so resuming lands on a still HOS until Play is pressed. `onBack`
 * returns to Landing.
 */
export default function HOSDetailScreen({ selected, startsPlaying = false, onBack }) {
  const {
    hosList,
    viewedIDs,
    buildInfo,
    markViewed,
    nextRandomHOS,
    setSlideIndex,
    reactionsFor,
    addReaction,
    removeLastReaction,
    imageZoomStateFor,
    setImageZoomStateFor,
    drawingDisplayModeFor,
    setDrawingDisplayModeFor,
    drawingFor,
    setDrawingFor,
  } = useAppModel();

  const startIndex = (() => {
    const found = hosList.findIndex((p) => p.order === selected.order);
    return found >= 0 ? found : 0;
  })();

  // Chosen on Landing; read-only here. Seconds to wait before fading in the details is the interval
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
  // below, so a new HOS's text is hidden in the same render that shows it — an effect runs
  // after paint, which let the new text flash at full opacity first.
  const [revealedIndex, setRevealedIndex] = useState(null);
  const [isRandomMode] = useStoredBoolean(SlideshowSettings.randomModeKey, SlideshowSettings.defaultRandomMode);
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(!startsPlaying);
  const isPlaying = !isSlideshowPaused;
  const [remainingSecs, setRemainingSecs] = useState(slideshowIntervalSecs);
  const [isDrawingEditorOpen, setIsDrawingEditorOpen] = useState(false);

  // `index` (which HOS is shown) and, in random mode, the walk's history/position all
  // change together, so they're one state object updated atomically. The history starts
  // over each time this screen is opened from Landing.
  const [nav, setNav] = useState({ index: startIndex, history: [startIndex], position: 0 });
  const index = nav.index;
  const hos = hosList[index];
  const detailsVisible = revealedIndex === index;

  // Mirrors `.task(id: index)`: mark viewed immediately, then fade the text in after a delay
  // that's cancelled (never revealed) if `index` changes again first.
  useEffect(() => {
    let cancelled = false;
    markViewed(hos, isPlaying);
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
  // HOS's image stays on top of the new one and fades out over `fadePeriod` as the new one
  // fades in. Manual browsing (while paused) swaps the image instantly. The switch is made during
  // render (not in an effect) so the outgoing image's layer is never unmounted, not even for one
  // commit: remounting it made a fresh <img> that flashed blank while the browser decoded it.
  const [fade, setFade] = useState({ shown: hos, outgoing: null });
  if (fade.shown.order !== hos.order) {
    setFade({ shown: hos, outgoing: isPlaying ? fade.shown : null });
  }
  const outgoing = fade.outgoing;
  useEffect(() => {
    if (!outgoing) return undefined;
    const timer = setTimeout(() => setFade((f) => ({ ...f, outgoing: null })), fadePeriod * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing]);

  // Mirrors `index` into `appModel.slideIndex` on every change (including the initial mount), so
  // it persists across this screen being unmounted and remounted — e.g. Back to Landing then
  // Resume, or a reload, reopens at the HOS last shown instead of always restarting at #1.
  useEffect(() => {
    setSlideIndex(index);
  }, [index, setSlideIndex]);

  function advanceForward(prevNav) {
    if (isRandomMode) {
      if (prevNav.position < prevNav.history.length - 1) {
        const position = prevNav.position + 1;
        return { ...prevNav, index: prevNav.history[position], position };
      }
      const next = nextRandomHOS();
      const newIndex = next ? hosList.findIndex((p) => p.order === next.order) : -1;
      if (newIndex < 0) return prevNav;
      const history = [...prevNav.history, newIndex];
      return { index: newIndex, history, position: history.length - 1 };
    }
    const newIndex = prevNav.index === hosList.length - 1 ? 0 : prevNav.index + 1;
    return { ...prevNav, index: newIndex };
  }

  function stepBackward(prevNav) {
    if (isRandomMode) {
      if (prevNav.position === 0) return prevNav;
      const position = prevNav.position - 1;
      return { ...prevNav, index: prevNav.history[position], position };
    }
    const newIndex = prevNav.index === 0 ? hosList.length - 1 : prevNav.index - 1;
    return { ...prevNav, index: newIndex };
  }

  // Auto-advance timer: always running (ticks are ignored while paused), uses a ref for the tick body so
  // the interval (set up once) always calls the latest closure instead of a stale one. The
  // updater is kept pure (just clamped decrement, no side effects) — React 18 StrictMode
  // intentionally double-invokes functional state updaters to catch impure ones, and an earlier
  // version of this that called `setNav(...)` from inside here had that side effect fire twice
  // per tick, advancing the slideshow by 2 heads of state instead of 1.
  const tickRef = useRef(() => {});
  // The drawing editor also holds the countdown, so the HOS can't change mid-drawing — matching
  // the Swift `isDrawingEditorPresented` check.
  tickRef.current = () => {
    if (!isPlaying || isDrawingEditorOpen) return;
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

  const orderText = String(hos.order).padStart(2, '0');
  const title = isPlaying
    ? `#${orderText} · ${remainingSecs.toFixed(1).padStart(4, '0')}s ${buildInfo}`
    : `#${orderText} ${buildInfo}`;

  const imageSrc = hos.large || hos.thumbnail;
  const drawing = drawingFor(hos);
  const articleURL = wikipediaArticleURL(hos);

  const isPreviousDisabled = isRandomMode && nav.position === 0;

  return (
    <div className="screen-scroll">
      <NavBar
        title={title}
        monospace
        onBack={onBack}
        trailing={
          <>
            {drawing && (
              <DrawingDisplayMenu
                mode={drawingDisplayModeFor(hos)}
                onChange={(mode) => setDrawingDisplayModeFor(mode, hos)}
              />
            )}
            <button className="nav-action" aria-label="Draw on Photo" onClick={() => setIsDrawingEditorOpen(true)}>
              <Icon name="pencil-square" size={18} />
            </button>
          </>
        }
      />
      <div className="detail">
        <ViewedProgressBar total={hosList.length} viewedIDs={viewedIDs} />

        <div className="header-fade" style={{ '--fade-period': `${fadePeriod}s` }}>
          {/* Both layers are keyed by HOS, so when the current one becomes the outgoing one
              React keeps its DOM (and its already-decoded <img>). The outgoing layer comes first
              so the incoming one is appended after it rather than moving it; z-index puts the
              outgoing one on top. A fresh key per HOS also resets zoom/pan state. */}
          {[outgoing, hos].filter(Boolean).map((p) => {
            const isOutgoing = p === outgoing;
            const src = p.large || p.thumbnail;
            const layerDrawing = drawingFor(p);
            const layerMode = drawingDisplayModeFor(p);
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
                  drawing={showsDrawing(layerMode) ? layerDrawing : null}
                  showsPhoto={showsPhoto(layerMode)}
                  reactions={reactionsFor(p)}
                  showsZoomControls={!isPlaying}
                />
              </div>
            );
          })}
        </div>

        <div className={detailsVisible ? 'detail-text visible' : 'detail-text'}>
          <h1 className="name-mono">
            #{hos.order} {hos.name}
          </h1>
          <p className="subtitle">
            {hos.term} · {hos.party}
          </p>
          <p>{hos.extract}</p>
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

      {isDrawingEditorOpen && (
        <HOSDrawingEditor
          hos={hos}
          imageSrc={imageSrc ? assetUrl(imageSrc) : null}
          initialDrawing={drawing}
          reactions={reactionsFor(hos)}
          onAddReaction={(emoji) => addReaction(emoji, hos)}
          onRemoveLastReaction={() => removeLastReaction(hos)}
          onClose={(result) => {
            setIsDrawingEditorOpen(false);
            if (result !== undefined) setDrawingFor(result, hos);
          }}
        />
      )}
    </div>
  );
}
