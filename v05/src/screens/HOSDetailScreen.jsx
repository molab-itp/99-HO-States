import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import { wikipediaArticleURL } from '../data/wikipedia.js';
import { assetUrl } from '../data/assetUrl.js';
import NavBar from '../components/NavBar.jsx';
import ViewedProgressBar from '../components/ViewedProgressBar.jsx';
import ZoomableHeaderImage from '../components/ZoomableHeaderImage.jsx';
import Icon from '../components/Icon.jsx';
import HOSDrawingEditor from '../components/HOSDrawingEditor.jsx';
import DrawingDisplayMenu from '../components/DrawingDisplayMenu.jsx';
import SpeechPlayButton from '../components/SpeechPlayButton.jsx';
import GreatestFigure from '../components/GreatestFigure.jsx';
import { greatestFor } from '../data/greatest.js';
import { showsDrawing, showsPhoto } from '../data/drawingDisplayMode.js';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredNumber } from '../state/useStoredNumber.js';
import { useStoredString } from '../state/useStoredString.js';
import { SlideshowSettings } from '../state/slideshowSettings.js';
import { SpeechSettings } from '../state/speechSettings.js';
import { useSpeechPlayer } from '../state/useSpeechPlayer.js';

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
    greatestPeopleFor,
    advanceGreatest,
    markGreatestShown,
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
  const [autoSpeak] = useStoredBoolean(SpeechSettings.autoSpeakKey, SpeechSettings.defaultAutoSpeak);
  const [autoSpeakMode] = useStoredString(SpeechSettings.autoSpeakModeKey, SpeechSettings.defaultAutoSpeakMode);
  // Owned here rather than by the speech button so the auto-advance below can hold until the
  // speech is done.
  const speechPlayer = useSpeechPlayer();

  // The index whose details have been revealed. Derived rather than a boolean reset in the effect
  // below, so a new HOS's text is hidden in the same render that shows it — an effect runs
  // after paint, which let the new text flash at full opacity first.
  const [revealedIndex, setRevealedIndex] = useState(null);
  const [isRandomMode] = useStoredBoolean(SlideshowSettings.randomModeKey, SlideshowSettings.defaultRandomMode);
  const [isAnimated] = useStoredBoolean(SlideshowSettings.animatedKey, SlideshowSettings.defaultAnimated);
  const [isAutoScroll] = useStoredBoolean(SlideshowSettings.autoScrollKey, SlideshowSettings.defaultAutoScroll);
  const [autoScrollGreatest] = useStoredNumber(
    SlideshowSettings.autoScrollGreatestKey,
    SlideshowSettings.defaultAutoScrollGreatest,
  );
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
  // Auto Scroll replaces the slideshow's fades and details delay with a hold at the end: while it
  // plays, the details are shown with the new HOS, in the same render.
  const fades = isPlaying && !isAutoScroll;
  const detailsVisible = revealedIndex === index || (isAutoScroll && isPlaying);

  // Mirrors `.task(id: index)`: mark viewed immediately, then fade the text in after a delay
  // that's cancelled (never revealed) if `index` changes again first.
  useEffect(() => {
    let cancelled = false;
    markViewed(hos, isPlaying);
    // Revealed at once under Auto Scroll, so pausing doesn't hide the details again.
    if (isAutoScroll && isPlaying) {
      setRevealedIndex(index);
      return undefined;
    }
    const timer = setTimeout(() => {
      if (!cancelled) setRevealedIndex(index);
    }, delaySecs * 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // This screen outlives the HOS it shows (Next/Previous/slideshow just swap `index`), so speech
  // for the previous one is stopped here. The drawing editor covers the summary, so it stops too.
  const stopSpeech = speechPlayer.stop;
  useEffect(() => stopSpeech, [index, stopSpeech]);
  useEffect(() => {
    if (isDrawingEditorOpen) stopSpeech();
  }, [isDrawingEditorOpen, stopSpeech]);

  // Port of the Swift ZStack + `.transition(.opacity)`: while the slideshow plays, the previous
  // HOS's image stays on top of the new one and fades out over `fadePeriod` as the new one
  // fades in. Manual browsing (while paused) swaps the image instantly. The switch is made during
  // render (not in an effect) so the outgoing image's layer is never unmounted, not even for one
  // commit: remounting it made a fresh <img> that flashed blank while the browser decoded it.
  const [fade, setFade] = useState({ shown: hos, outgoing: null });
  if (fade.shown.order !== hos.order) {
    setFade({ shown: hos, outgoing: fades ? fade.shown : null });
  }
  const outgoing = fade.outgoing;
  useEffect(() => {
    if (!outgoing) return undefined;
    const timer = setTimeout(() => setFade((f) => ({ ...f, outgoing: null })), fadePeriod * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing]);

  // Has the app model pick the Greatest order for each HOS shown (Swift's `advanceGreatest()`),
  // before it's painted so its summary never draws in an unpicked order first. The ref keeps
  // StrictMode's repeated mount effect from picking again and marking another lead as shown.
  const greatestAdvancedForRef = useRef(null);
  useLayoutEffect(() => {
    if (greatestAdvancedForRef.current === hos.order) return;
    greatestAdvancedForRef.current = hos.order;
    advanceGreatest(hos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

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

  // Auto Scroll: while playing, the details scroll slowly down once they've faded in, until the
  // first `autoScrollGreatest` of the period's 100 Greatest (or all of them, or the bottom if there
  // are fewer) have come fully into view above the toolbar, and the slide holds until they get
  // there and then for the Fadein Delay more. A requestAnimationFrame loop moves the window once
  // per display frame (Swift's `FrameTicker`). The stopping point is measured from the DOM each
  // frame, so it follows lazy-loaded photos as they come in.
  const greatestRefs = useRef([]);
  const extractRef = useRef(null);
  const toolbarRef = useRef(null);
  const autoScrollOffsetRef = useRef(0);
  // When Auto Scroll reached its stopping point for this HOS (`performance.now()`), timing the
  // hold there before the slide advances.
  const autoScrollDoneTimeRef = useRef(null);
  // Until when (`performance.now()`) Auto Scroll holds at the top of a new HOS: the Fadein Delay
  // (while, with Animated on, the portrait zooms in), and only then starts scrolling.
  const autoScrollHoldUntilRef = useRef(0);
  const greatestCount = greatestFor(hos).length;
  // How many of the Greatest Auto Scroll shows, so with Auto Speak on, speaks.
  const autoScrollGreatestCount = autoScrollGreatest > 0 ? Math.min(autoScrollGreatest, greatestCount) : greatestCount;

  function visibleHeight() {
    return window.innerHeight - (toolbarRef.current?.offsetHeight ?? 0);
  }

  function pageBottom(el) {
    return el.getBoundingClientRect().bottom + window.scrollY;
  }

  function autoScrollTarget() {
    const scrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (autoScrollGreatest <= 0 || autoScrollGreatest >= greatestCount) return scrollable;
    const figure = greatestRefs.current[autoScrollGreatest - 1];
    if (!figure) return scrollable;
    return Math.min(scrollable, Math.max(0, pageBottom(figure) - visibleHeight()));
  }

  function isAutoScrollDone() {
    return autoScrollOffsetRef.current >= autoScrollTarget();
  }

  // Auto Scroll with Auto Speak: the HOS's extract is spoken and then, one after another, each
  // Greatest figure Auto Scroll shows, each starting as the figure scrolls on. The scroll pauses
  // wherever the text being spoken has come fully into view, until it's been spoken.
  const speaksAsScrolling = autoSpeak && isAutoScroll && isPlaying && speechPlayer.isAvailable;
  // What's being spoken: 0 for the HOS, then 1 + the index of the Greatest figure. Kept with the
  // HOS it's for, so a new HOS starts at 0 in the render that shows it.
  const [speechStageState, setSpeechStageState] = useState({ order: hos.order, stage: 0 });
  const speechStage = speechStageState.order === hos.order ? speechStageState.stage : 0;
  // The stage whose speech was last started, so only its speech finishing (not the last HOS's
  // being stopped by the slide advancing) moves on to the next stage.
  const speakingStageRef = useRef(null);
  useEffect(() => {
    if (speechPlayer.isBusy) {
      speakingStageRef.current = { order: hos.order, stage: speechStage };
    } else if (
      speaksAsScrolling &&
      speakingStageRef.current?.order === hos.order &&
      speakingStageRef.current.stage === speechStage
    ) {
      setSpeechStageState({ order: hos.order, stage: speechStage + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechPlayer.isBusy]);

  // The offset Auto Scroll pauses at while the current stage is spoken: its text's bottom lined
  // up with the bottom of the visible area. Until the extract has been laid out, the top.
  function speechPauseOffset() {
    if (!speaksAsScrolling || speechStage > autoScrollGreatestCount) return null;
    if (speechStage === 0) {
      return extractRef.current ? Math.max(0, pageBottom(extractRef.current) - visibleHeight()) : 0;
    }
    const figure = greatestRefs.current[speechStage - 1];
    return figure ? Math.max(0, pageBottom(figure) - visibleHeight()) : null;
  }

  // How many Greatest figures have had their top scrolled on, for this HOS; set from the scroll loop.
  const [greatestOnScreen, setGreatestOnScreen] = useState({ order: hos.order, count: 0 });
  // The Greatest figure to speak now: the current stage's, once its top has scrolled on.
  const autoSpokenGreatest =
    speaksAsScrolling &&
    detailsVisible &&
    speechStage > 0 &&
    speechStage - 1 < autoScrollGreatestCount &&
    greatestOnScreen.order === hos.order &&
    speechStage - 1 < greatestOnScreen.count
      ? speechStage - 1
      : null;

  // Back to the top for each new HOS before it's painted, so it's never drawn at the last one's
  // scroll offset (Swift's `setIndex`).
  useLayoutEffect(() => {
    if (!isAutoScroll) return;
    autoScrollOffsetRef.current = 0;
    autoScrollDoneTimeRef.current = null;
    autoScrollHoldUntilRef.current = isPlaying ? performance.now() + delaySecs * 1000 : 0;
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const isAutoScrolling = isAutoScroll && isPlaying && detailsVisible && !isDrawingEditorOpen;
  const autoScrollTargetRef = useRef(autoScrollTarget);
  autoScrollTargetRef.current = autoScrollTarget;
  const speechPauseOffsetRef = useRef(speechPauseOffset);
  speechPauseOffsetRef.current = speechPauseOffset;
  // Counts the Greatest whose top is above the bottom of the visible area.
  const updateGreatestOnScreenRef = useRef(null);
  updateGreatestOnScreenRef.current = () => {
    const limit = autoScrollOffsetRef.current + visibleHeight();
    let count = 0;
    while (count < autoScrollGreatestCount) {
      const figure = greatestRefs.current[count];
      if (!figure || figure.getBoundingClientRect().top + window.scrollY >= limit) break;
      count += 1;
    }
    if (greatestOnScreen.order !== hos.order || greatestOnScreen.count !== count) {
      setGreatestOnScreen({ order: hos.order, count });
    }
  };
  // Greatest Auto Scroll has scrolled past count as shown.
  const onAutoScrollDoneRef = useRef(null);
  onAutoScrollDoneRef.current = () => markGreatestShown(hos, autoScrollGreatest);
  useEffect(() => {
    if (!isAutoScrolling) return undefined;
    let frame;
    let last = performance.now();
    // Slows over the last `autoScrollEaseDistance` pixels so it settles at the stopping point (or
    // a pause for speech) instead of halting mid-stride, and notes when it gets to the stopping
    // point, which starts the hold before the slide advances.
    const step = (now) => {
      updateGreatestOnScreenRef.current();
      const fullTarget = autoScrollTargetRef.current();
      const target = Math.min(fullTarget, speechPauseOffsetRef.current() ?? Infinity);
      const remaining = target - autoScrollOffsetRef.current;
      if (now < autoScrollHoldUntilRef.current) {
        // Holding at the top of a new HOS.
      } else if (remaining <= 0) {
        if (autoScrollOffsetRef.current >= fullTarget && autoScrollDoneTimeRef.current === null) {
          autoScrollDoneTimeRef.current = now;
          onAutoScrollDoneRef.current();
        }
      } else {
        // A photo loading late can push the stopping point further down after it was reached.
        autoScrollDoneTimeRef.current = null;
        const ease = Math.min(1, Math.max(0.15, remaining / SlideshowSettings.autoScrollEaseDistance));
        const delta = (SlideshowSettings.autoScrollSpeed * ease * (now - last)) / 1000;
        // Within half a pixel of the end it just lands there.
        autoScrollOffsetRef.current = remaining - delta < 0.5 ? target : autoScrollOffsetRef.current + delta;
        window.scrollTo(0, autoScrollOffsetRef.current);
      }
      last = now;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isAutoScrolling]);

  // Auto-advance timer: always running (ticks are ignored while paused), uses a ref for the tick body so
  // the interval (set up once) always calls the latest closure instead of a stale one. The
  // updater is kept pure (just a decrement, no side effects) — React 18 StrictMode
  // intentionally double-invokes functional state updaters to catch impure ones, and an earlier
  // version of this that called `setNav(...)` from inside here had that side effect fire twice
  // per tick, advancing the slideshow by 2 heads of state instead of 1.
  const tickRef = useRef(() => {});
  // The drawing editor also holds the countdown, so the HOS can't change mid-drawing — matching
  // the Swift `isDrawingEditorPresented` check.
  tickRef.current = () => {
    if (!isPlaying || isDrawingEditorOpen) return;
    // Not clamped at zero: while Auto Speak holds the advance below, this keeps counting down
    // into negative numbers, so the title shows how long the slide has run over.
    setRemainingSecs((prev) => prev - SLIDESHOW_TICK_SECS);
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
    // With Auto Speak on, the slide stays up until the speech is done. The countdown
    // keeps ticking meanwhile, so this is checked again every tick.
    if (autoSpeak && speechPlayer.isBusy) return;
    // With Auto Scroll on, it stays up until the details have scrolled past the chosen Greatest,
    // and then for the Fadein Delay.
    if (isAutoScroll) {
      const doneTime = autoScrollDoneTimeRef.current;
      if (!isAutoScrollDone() || doneTime === null || performance.now() - doneTime < delaySecs * 1000) return;
    }
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
  // Negative once the slide has run over its time (held for Auto Speak). Anything that would
  // round to zero shows as "00.0", never "-0.0".
  const isOvertime = remainingSecs <= -0.05;
  const secondsText = `${isOvertime ? '-' : ''}${(isOvertime ? -remainingSecs : Math.max(0, remainingSecs)).toFixed(1).padStart(4, '0')}`;
  const title = isPlaying ? `#${orderText} · ${secondsText}s ${buildInfo}` : `#${orderText} ${buildInfo}`;

  const imageSrc = hos.large || hos.thumbnail;
  const drawing = drawingFor(hos);
  const articleURL = wikipediaArticleURL(hos);
  // Auto Speak's mode swaps the extract for the order and name, or for the extract's first sentence.
  const speechMode = autoSpeak ? autoSpeakMode : 'summary';
  const speechText =
    speechMode === 'name'
      ? `${hos.order} ${hos.name}`
      : speechMode === 'caption'
        ? SpeechSettings.firstSentence(hos.extract)
        : hos.extract;

  const isPreviousDisabled = isRandomMode && nav.position === 0;
  const greatest = greatestPeopleFor(hos);

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
                  // Runs for the details delay, starting once the cross-fade has finished, so the
                  // full photo fades in first and then pans/zooms (as in Swift).
                  zoomInSecs={isAnimated && isPlaying ? delaySecs : null}
                  zoomInDelaySecs={outgoing ? fadePeriod : 0}
                />
              </div>
            );
          })}
        </div>

        <div className={`detail-text${detailsVisible ? ' visible' : ''}${isAutoScroll && isPlaying ? ' no-fade' : ''}`}>
          <div className="name-row">
            <h1 className="name-mono">
              #{hos.order} {hos.name}
            </h1>
            {/* Auto speech starts as the details fade in, so the extract is on screen for it. */}
            <SpeechPlayButton
              player={speechPlayer}
              text={speechText}
              translatesFirst
              autoPlays={autoSpeak && isPlaying && detailsVisible && !(speaksAsScrolling && speechStage > 0)}
            />
          </div>
          <p className="subtitle">
            {hos.term} · {hos.party}
          </p>
          <p ref={extractRef}>{hos.extract}</p>
          {articleURL && (
            <a className="wiki-link" href={articleURL} target="_blank" rel="noopener noreferrer">
              <Icon name="book" size={14} />
              Read on Wikipedia
            </a>
          )}
          {/* HOSSummaryView's Greatest figures alive during the term. */}
          {greatest.length > 0 && (
            <div className="period-greatest">
              <h2 className="period-greatest-title">100 Greatest of this period</h2>
              {greatest.map((person, i) => (
                <div key={person.id} ref={(el) => (greatestRefs.current[i] = el)}>
                  <GreatestFigure
                    person={person}
                    speechPlayer={speechPlayer}
                    autoSpeaks={autoSpokenGreatest === i}
                    speechMode={speechMode}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="detail-toolbar" ref={toolbarRef}>
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
