import { useAppModel } from '../state/AppModelContext.jsx';
import Icon from '../components/Icon.jsx';
import SegmentedPicker from '../components/SegmentedPicker.jsx';
import { SlideshowSettings } from '../state/slideshowSettings.js';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredNumber } from '../state/useStoredNumber.js';
import links from '../data/links.js';

/**
 * Port of LandingView.swift — the app's root screen: settings, app info, and the ways into
 * `HOSDetailScreen` (Resume, Random Head, Start Slideshow), `HOSListScreen`, `NewsScreen`,
 * `CreditsScreen` and `SpeechSetupScreen`. Navigation itself is handed back to `App` through the
 * callbacks: `onShowList()` shows the list, `onShowDetail(startSlideshow)` shows the detail screen
 * at `slideIndex`, with its slideshow playing if asked, `onShowNews()` shows the news screen,
 * `onShowCredits()` the credits screen and `onShowSpeechSetup()` the text-to-speech setup screen.
 */
export default function LandingScreen({ onShowList, onShowDetail, onShowNews, onShowCredits, onShowSpeechSetup }) {
  const { hosList, viewedIDs, nextRandomHOS, select, resetViewed, buildInfo } = useAppModel();
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

  const remainingCount = hosList.length - viewedIDs.size;

  return (
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
        <button className="btn btn-prominent" onClick={() => onShowDetail(false)}>
          <Icon name="redo" />
          Resume
        </button>
        <button className="btn btn-bordered" onClick={onShowNews}>
          <Icon name="newspaper" />
          News
        </button>
        <button className="btn btn-bordered" onClick={onShowList}>
          <Icon name="list-ul" />
          List of Heads
        </button>
        <button
          className="btn btn-bordered"
          onClick={() => {
            const hos = nextRandomHOS();
            if (!hos) return;
            select(hos);
            onShowDetail(false);
          }}
        >
          <Icon name="shuffle" />
          Random Head
        </button>
        <button className="btn btn-bordered" onClick={onShowSpeechSetup}>
          <Icon name="volume-up" />
          Speak
        </button>
        <button className="btn btn-bordered" onClick={() => onShowDetail(true)}>
          <Icon name="play-circle-fill" />
          Start Slideshow
        </button>
        <label className="toggle-row">
          <span>Random Mode</span>
          <span className="switch">
            <input type="checkbox" checked={isRandomMode} onChange={(e) => setIsRandomMode(e.target.checked)} />
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
      </div>

      <div className="visited">
        <p className="visited-count">{remainingCount} left to see</p>
        <button className="btn btn-bordered btn-destructive" onClick={resetViewed}>
          Reset Visit Count
        </button>
        <button className="btn btn-bordered" onClick={onShowCredits}>
          <Icon name="info-circle" />
          Credits
        </button>
      </div>

      <div className="source-links">
        {links.map((link) => (
          <a key={link.url} className="source-link" href={link.url} target="_blank" rel="noopener noreferrer">
            <Icon name="link-45deg" size={14} />
            {link.title}
          </a>
        ))}
      </div>

      <p className="build-info">{buildInfo}</p>
    </div>
  );
}
