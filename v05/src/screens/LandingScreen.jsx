import { useAppModel } from '../state/AppModelContext.jsx';
import { useAuth } from '../account/AuthContext.jsx';
import { displayName } from '../account/AccountScreen.jsx';
import Icon from '../components/Icon.jsx';
import SegmentedPicker from '../components/SegmentedPicker.jsx';
import { SlideshowSettings } from '../state/slideshowSettings.js';
import { useStoredBoolean } from '../state/useStoredBoolean.js';
import { useStoredNumber } from '../state/useStoredNumber.js';

/**
 * Port of LandingView.swift — the app's root screen: settings, app info, and the ways into
 * `HOSDetailScreen` (Resume, Random Head, Start Slideshow), `HOSListScreen`, `NewsScreen`,
 * `GreatestScreen`, `CreditsScreen`, `SpeechSetupScreen` and `AccountScreen` (when the
 * Supabase project is set up). Navigation itself is handed back to `App` through the
 * callbacks: `onShowList()` shows the list, `onShowDetail(startSlideshow)` shows the detail screen
 * at `slideIndex`, with its slideshow playing if asked, `onShowNews()` shows the news screen,
 * `onShowGreatest()` the 100 Greatest African Americans listing, `onShowCredits()` the credits screen, `onShowSpeechSetup()` the text-to-speech setup screen and `onShowAccount()` the account screen.
 */
export default function LandingScreen({
  onShowList,
  onShowDetail,
  onShowNews,
  onShowGreatest,
  onShowCredits,
  onShowSpeechSetup,
  onShowAccount,
}) {
  const { hosList, viewedIDs, nextRandomHOS, select, resetVisitCount, resetApp, buildInfo } = useAppModel();
  const [isRandomMode, setIsRandomMode] = useStoredBoolean(
    SlideshowSettings.randomModeKey,
    SlideshowSettings.defaultRandomMode,
  );
  const [isAnimated, setIsAnimated] = useStoredBoolean(
    SlideshowSettings.animatedKey,
    SlideshowSettings.defaultAnimated,
  );
  const [isAutoScroll, setIsAutoScroll] = useStoredBoolean(
    SlideshowSettings.autoScrollKey,
    SlideshowSettings.defaultAutoScroll,
  );
  const [autoScrollGreatest, setAutoScrollGreatest] = useStoredNumber(
    SlideshowSettings.autoScrollGreatestKey,
    SlideshowSettings.defaultAutoScrollGreatest,
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

  // `null` when `.env.local` isn't set up, which hides the Account button.
  const auth = useAuth();

  const remainingCount = hosList.length - viewedIDs.size;

  return (
    <div className="home">
      <div className="icon">
        <Icon name="bank" size={64} />
      </div>
      <h1>USnA Heads and 100 Greatest</h1>
      <p className="subtitle">
        Who defines a nation?
        <br />
        Browse portraits and biographies of every Head of State
        <br />
        of the United States of north America
        <br />
        supplemented with 100 of the greatest African Americans
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
        <button className="btn btn-bordered" onClick={onShowGreatest}>
          <Icon name="people" />
          100 Greatest
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
        <div className="visited">
          <p className="visited-count">{remainingCount} left to see</p>
          <button className="btn btn-bordered btn-destructive" onClick={resetVisitCount}>
            Reset Visit Count
          </button>
        </div>
        <label className="toggle-row">
          <span>Random Mode</span>
          <span className="switch">
            <input type="checkbox" checked={isRandomMode} onChange={(e) => setIsRandomMode(e.target.checked)} />
            <span className="switch-track" />
            <span className="switch-thumb" />
          </span>
        </label>
        <label className="toggle-row">
          <span>Animated</span>
          <span className="switch">
            <input type="checkbox" checked={isAnimated} onChange={(e) => setIsAnimated(e.target.checked)} />
            <span className="switch-track" />
            <span className="switch-thumb" />
          </span>
        </label>
        <label className="toggle-row">
          <span>Auto Scroll</span>
          <span className="switch">
            <input type="checkbox" checked={isAutoScroll} onChange={(e) => setIsAutoScroll(e.target.checked)} />
            <span className="switch-track" />
            <span className="switch-thumb" />
          </span>
        </label>
        <SegmentedPicker
          label="Scroll Past Greatest"
          options={SlideshowSettings.autoScrollGreatestOptions}
          value={autoScrollGreatest}
          onChange={setAutoScrollGreatest}
          formatOption={(count) => (count === 0 ? 'All' : `${count}`)}
          disabled={!isAutoScroll}
        />
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

      <div className="actions">
        <button className="btn btn-bordered" onClick={onShowCredits}>
          <Icon name="info-circle" />
          Credits
        </button>
        {auth && (
          <button className="btn btn-bordered" onClick={onShowAccount}>
            <Icon name="person-circle" />
            {auth.state.status === 'signedIn' ? displayName(auth.state.user) : 'Sign In'}
          </button>
        )}
        <button
          className="btn btn-bordered btn-destructive"
          onClick={() => {
            // Stands in for v2's `confirmationDialog`.
            if (
              window.confirm(
                "Reset App?\n\nClears all reactions, drawings, zoom, visit progress and settings. This can't be undone.",
              )
            ) {
              resetApp();
            }
          }}
        >
          <Icon name="arrow-counterclockwise" />
          Reset App
        </button>
      </div>

      <p className="build-info">{buildInfo}</p>
    </div>
  );
}
