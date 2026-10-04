import { useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import SegmentedPicker from '../components/SegmentedPicker.jsx';
import PresidentListScreen from './PresidentListScreen.jsx';
import { SlideshowSettings } from '../state/slideshowSettings.js';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredNumber } from '../state/useStoredNumber.js';
import links from '../data/links.js';

/**
 * Port of SettingsView.swift: settings and app info, presented as a full-screen sheet from the
 * detail screen's info button. Actions that change what's displayed (picking from the list,
 * Random Head, Start Slideshow) are handed back through `onSelect` / `onStartSlideshow`, and
 * dismiss the sheet via `onClose`. The List of Heads is pushed inside the sheet, standing in for
 * the sheet's own `NavigationStack`.
 */
export default function SettingsScreen({ onSelect, onStartSlideshow, onClose }) {
  const { presidents, viewedIDs, nextRandomPresident, resetViewed, buildInfo } = useAppModel();
  const [isListShown, setIsListShown] = useState(false);
  const [isRandomMode, setIsRandomMode] = useStoredBoolean(
    SlideshowSettings.randomModeKey,
    SlideshowSettings.defaultRandomMode,
  );
  const [slideshowIntervalSecs, setSlideshowIntervalSecs] = useStoredNumber(
    SlideshowSettings.intervalSecsKey,
    SlideshowSettings.defaultIntervalSecs,
  );
  const [delayFraction, setDelayFraction] = useStoredNumber(
    SlideshowSettings.delayFractionKey,
    SlideshowSettings.defaultDelayFraction,
  );
  const [fadePeriod, setFadePeriod] = useStoredNumber(
    SlideshowSettings.fadePeriodKey,
    SlideshowSettings.defaultFadePeriod,
  );

  const remainingCount = presidents.length - viewedIDs.size;

  function select(president) {
    if (!president) return;
    onSelect(president);
    onClose();
  }

  return (
    <div className="settings-sheet" role="dialog" aria-label="Settings">
      {isListShown ? (
        <PresidentListScreen onSelect={select} onBack={() => setIsListShown(false)} />
      ) : (
        <>
          <NavBar
            title=""
            trailing={
              <button className="nav-action nav-action-text" onClick={onClose}>
                Done
              </button>
            }
          />
          <div className="home">
            <div className="icon">
              <Icon name="bank" size={64} />
            </div>
            <h1>USnA Heads</h1>
            <p className="subtitle">
              Browse portraits and biographies of every Head of State
              <br />
              of the United States of north America
            </p>

            <div className="actions">
              <button className="btn btn-bordered" onClick={() => setIsListShown(true)}>
                <Icon name="list-ul" />
                List of Heads
              </button>
              <button className="btn btn-bordered" onClick={() => select(nextRandomPresident())}>
                <Icon name="shuffle" />
                Random Head
              </button>
              <label className="toggle-row">
                <span>Random Mode</span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={isRandomMode}
                    onChange={(e) => setIsRandomMode(e.target.checked)}
                  />
                  <span className="switch-track" />
                  <span className="switch-thumb" />
                </span>
              </label>
              <SegmentedPicker
                label="Slide Interval"
                options={SlideshowSettings.intervalSecsOptions}
                value={slideshowIntervalSecs}
                onChange={setSlideshowIntervalSecs}
                formatOption={(secs) => `${secs}s`}
              />
              <SegmentedPicker
                label="Fadein Delay"
                options={SlideshowSettings.delayFractionOptions}
                value={delayFraction}
                onChange={setDelayFraction}
                formatOption={(fraction) => `${(slideshowIntervalSecs * fraction).toFixed(1)}s`}
              />
              <SegmentedPicker
                label="Fade Period"
                options={SlideshowSettings.fadePeriodOptions}
                value={fadePeriod}
                onChange={setFadePeriod}
                formatOption={(secs) => `${secs}s`}
              />
              <button
                className="btn btn-bordered"
                onClick={() => {
                  onStartSlideshow();
                  onClose();
                }}
              >
                <Icon name="play-circle-fill" />
                Start Slideshow
              </button>
            </div>

            <div className="visited">
              <p className="visited-count">{remainingCount} left to see</p>
              <button className="btn-text-destructive" onClick={resetViewed}>
                Reset Visit Count
              </button>
            </div>

            <div className="source-links">
              {links.map((link) => (
                <a
                  key={link.url}
                  className="source-link"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="link-45deg" size={14} />
                  {link.title}
                </a>
              ))}
            </div>

            <p className="build-info">{buildInfo}</p>
          </div>
        </>
      )}
    </div>
  );
}
