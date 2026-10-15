import { useEffect, useRef, useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import NavBar from '../components/NavBar.jsx';
import Icon from '../components/Icon.jsx';
import GreatestFigure from '../components/GreatestFigure.jsx';
import greatestList from '../data/greatest.js';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredNumber } from '../state/useStoredNumber.js';
import { useStoredString } from '../state/useStoredString.js';
import { SlideshowSettings } from '../state/slideshowSettings.js';
import { SpeechSettings } from '../state/speechSettings.js';
import { useSpeechPlayer } from '../state/useSpeechPlayer.js';

const SLIDESHOW_TICK_SECS = 0.1; // matches GreatestDetailView's slideshowTickSecs

/**
 * Port of GreatestFigureView.swift's `GreatestDetailView` — one Greatest figure on its own screen,
 * with Previous / Play-Pause / Next to step or run a slideshow through the list (wrapping at
 * either end), timed by the slideshow interval set on Landing. Opens on the person at
 * `appModel.greatestIndex`; pushed from `GreatestScreen`, and `onBack` returns there. Like
 * `HOSDetailScreen`, with Auto Speak on the slideshow speaks each figure (once the details delay
 * has passed) and holds the advance until the speech is done.
 */
export default function GreatestDetailScreen({ onBack }) {
  const { greatestIndex, setGreatestIndex } = useAppModel();

  const [slideshowIntervalSecs] = useStoredNumber(
    SlideshowSettings.intervalSecsKey,
    SlideshowSettings.defaultIntervalSecs,
  );
  const [delayFraction] = useStoredNumber(
    SlideshowSettings.delayFractionKey,
    SlideshowSettings.defaultDelayFraction,
  );
  const delaySecs = slideshowIntervalSecs * delayFraction;
  const [autoSpeak] = useStoredBoolean(SpeechSettings.autoSpeakKey, SpeechSettings.defaultAutoSpeak);
  const [autoSpeakMode] = useStoredString(SpeechSettings.autoSpeakModeKey, SpeechSettings.defaultAutoSpeakMode);
  const speechPlayer = useSpeechPlayer();

  const [index, setIndex] = useState(() => (greatestList[greatestIndex] ? greatestIndex : 0));
  const person = greatestList[index];
  const [isSlideshowPaused, setIsSlideshowPaused] = useState(true);
  const isPlaying = !isSlideshowPaused;
  const [remainingSecs, setRemainingSecs] = useState(slideshowIntervalSecs);
  // The index for which Auto Speak has been armed, `delaySecs` after it appeared — derived (like
  // `HOSDetailScreen`'s `revealedIndex`) so a new figure is unarmed in the render that shows it.
  const [armedIndex, setArmedIndex] = useState(null);
  const isSpeechArmed = armedIndex === index;

  // Mirrors `.task(id: index)`: stop the previous figure's speech, then arm Auto Speak after the
  // details delay, cancelled if `index` changes again first.
  const stopSpeech = speechPlayer.stop;
  useEffect(() => {
    stopSpeech();
    const timer = setTimeout(() => setArmedIndex(index), delaySecs * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useEffect(() => stopSpeech, [stopSpeech]);

  // Kept in the app model so the address bar names the figure shown and a reload reopens on it.
  useEffect(() => {
    setGreatestIndex(index);
  }, [index, setGreatestIndex]);

  // Each figure starts at the top of the page, as the photo leads.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [index]);

  // Same always-running ticker as `HOSDetailScreen`: the tick body is read through a ref so the
  // interval set up once always sees the current state, and the updater stays a pure decrement.
  const tickRef = useRef(() => {});
  tickRef.current = () => {
    if (!isPlaying) return;
    // Not clamped at zero, so the title shows how long Auto Speak has held the slide over.
    setRemainingSecs((prev) => prev - SLIDESHOW_TICK_SECS);
  };
  useEffect(() => {
    const id = setInterval(() => tickRef.current(), SLIDESHOW_TICK_SECS * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remainingSecs >= SLIDESHOW_TICK_SECS / 2) return;
    if (autoSpeak && speechPlayer.isBusy) return;
    goToNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSecs]);

  function goToPrevious() {
    setIndex((i) => (i === 0 ? greatestList.length - 1 : i - 1));
    setRemainingSecs(slideshowIntervalSecs);
  }

  function goToNext() {
    setIndex((i) => (i === greatestList.length - 1 ? 0 : i + 1));
    setRemainingSecs(slideshowIntervalSecs);
  }

  const orderText = `#${String(person.order).padStart(3, '0')}`;
  const isOvertime = remainingSecs <= -0.05;
  const secondsText = `${isOvertime ? '-' : ''}${(isOvertime ? -remainingSecs : Math.max(0, remainingSecs)).toFixed(1).padStart(4, '0')}`;
  const title = isPlaying ? `${orderText} · ${secondsText}s` : orderText;

  return (
    <div className="screen-scroll">
      <NavBar title={title} monospace onBack={onBack} />
      <div className="detail">
        <GreatestFigure
          person={person}
          speechPlayer={speechPlayer}
          autoSpeaks={autoSpeak && isPlaying && isSpeechArmed}
          speaksName={autoSpeak && autoSpeakMode === 'name'}
        />
      </div>

      <div className="detail-toolbar">
        <button className="toolbar-btn toolbar-btn-icon" aria-label="Previous" onClick={goToPrevious}>
          <Icon name="chevron-left" size={20} />
        </button>
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label={isSlideshowPaused ? 'Play' : 'Pause'}
          onClick={() => setIsSlideshowPaused((p) => !p)}
        >
          <Icon name={isSlideshowPaused ? 'play-circle-fill' : 'pause-circle-fill'} size={19} />
        </button>
        <button className="toolbar-btn toolbar-btn-icon" aria-label="Next" onClick={goToNext}>
          <Icon name="chevron-right" size={20} />
        </button>
      </div>
    </div>
  );
}
