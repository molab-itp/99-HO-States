// Port of ShakesView.swift: records the signed-in user's shakes while open, and ranks every user
// by total shakes, with the leader shown large at the top.
import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import Spinner from '../components/Spinner.jsx';
import { profileName, relativeTime } from '../models/profile.js';
import { currentDeviceInfo } from '../models/shakeDeviceInfo.js';
import { intensityLabel, shakePattern } from '../models/shakeMotion.js';
import { rankShakers, shakeDurationText, totalShakes } from '../models/shakeSession.js';
import { useAuth } from '../services/AuthContext.jsx';
import { publicURL } from '../services/profilePhotoService.js';
import { fetchAll } from '../services/profilesService.js';
import { fetchTotals, observeChanges, record } from '../services/shakesService.js';
import { useLocationTracker } from '../services/useLocationTracker.js';
import { useShakeDetector } from '../services/useShakeDetector.js';
import ShakeHistoryView from './ShakeHistoryView.jsx';
import { useRoute } from './useRoute.js';

export default function ShakesView({ currentUserID }) {
  const { client } = useAuth();
  const { route, push, back } = useRoute();
  const [rankings, setRankings] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === 'visible');
  /** Bumped whenever the leader's total goes up, which jiggles the leader card. */
  const [leaderJiggle, setLeaderJiggle] = useState(0);
  // The leader's total as of the last reload; null before the first.
  const leaderTotal = useRef(null);

  const historyID = route.name === 'shakeHistory' || route.name === 'shakeSession' ? route.id : null;
  const sessionID = route.name === 'shakeSession' ? route.sessionID : null;

  const reload = useCallback(async () => {
    try {
      const [profiles, totals] = await Promise.all([fetchAll(client), fetchTotals(client)]);
      const ranked = rankShakers(profiles, totals);
      setRankings(ranked);
      // Jiggle when the top total goes up, whether the same leader shook more or someone overtook
      // them. Not on the first load.
      const top = ranked[0] ? totalShakes(ranked[0]) : 0;
      if (leaderTotal.current != null && top > 0 && top > leaderTotal.current) setLeaderJiggle((n) => n + 1);
      leaderTotal.current = top;
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error.message);
    }
    setHasLoaded(true);
  }, [client]);

  // Counts only while this screen is in front: not under a user's history, and not with the page
  // in the background (the iOS app's `scenePhase`).
  const recording = isVisible && !historyID;
  const location = useLocationTracker(recording);

  const save = useCallback(
    async (burst) => {
      setIsSaving(true);
      try {
        await record(client, {
          shake_count: burst.count,
          duration_ms: burst.durationMS,
          started_at: burst.startedAt.toISOString(),
          device: await currentDeviceInfo(location.current, burst),
        });
        setErrorMessage(null);
        await reload();
      } catch (error) {
        setErrorMessage(`Couldn't save that burst: ${error.message}`);
      }
      setIsSaving(false);
    },
    [client, reload, location],
  );

  const detector = useShakeDetector({ active: recording, onBurstEnded: save });

  /** The top-ranked user, once anyone has shaken. */
  const leader = rankings[0] && totalShakes(rankings[0]) > 0 ? rankings[0] : null;
  const leaderIsMe = leader?.profile.id === currentUserID;

  // Live shakes by the leader count as their total going up.
  const previousCount = useRef(0);
  useEffect(() => {
    if (detector.currentCount > previousCount.current && leaderIsMe) setLeaderJiggle((n) => n + 1);
    previousCount.current = detector.currentCount;
  }, [detector.currentCount, leaderIsMe]);

  useEffect(() => {
    reload();
    const onVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsVisible(visible);
      if (visible) reload();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [reload]);

  useEffect(() => observeChanges(client, reload, setLiveError), [client, reload]);

  if (historyID) {
    const ranking = rankings.find((r) => r.profile.id === historyID);
    if (!ranking) {
      return (
        <div className="app-shell">
          <NavBar title="" onBack={back} />
          <div className="unavailable">
            {hasLoaded ? <h1>No such user</h1> : <Spinner large />}
          </div>
        </div>
      );
    }
    return (
      <ShakeHistoryView
        profile={ranking.profile}
        isCurrentUser={historyID === currentUserID}
        sessionID={sessionID}
        onOpenSession={(session) => push(`/shakes/${historyID}/${session.id}`)}
        onBack={back}
        onChange={reload}
      />
    );
  }

  const myTotals = rankings.find((r) => r.profile.id === currentUserID)?.totals ?? null;
  /** Everyone below the leader card. */
  const others = leader ? rankings.slice(1) : rankings;
  const shownError = errorMessage ?? (liveError && `Live updates are off: ${liveError}`);

  return (
    <div className="app-shell">
      <NavBar
        title="Shakes"
        onBack={back}
        leading={
          <button className="nav-button" onClick={reload} aria-label="Refresh">
            <Icon name="arrow-clockwise" size={18} />
          </button>
        }
      />
      <div className="list-screen">
        <h2 className="section-header">Your shaking</h2>
        <Recorder detector={detector} myTotals={myTotals} isSaving={isSaving} />
        <SensorFooter detector={detector} />

        {shownError && <p className="error-text list-error">{shownError}</p>}

        <h2 className="section-header">Leaderboard</h2>
        {!hasLoaded ? (
          <div className="unavailable">
            <Spinner large />
          </div>
        ) : (
          <ul className="list list-ranked">
            {leader && (
              <li className="list-item leader-item">
                <button className="list-row" onClick={() => push(`/shakes/${leader.profile.id}`)}>
                  <LeaderCard
                    ranking={leader}
                    isCurrentUser={leaderIsMe}
                    photoURL={publicURL(client, leader.profile.photo_path ?? leader.profile.photo_thumb_path)}
                    jiggle={leaderJiggle}
                  />
                  <Icon className="list-chevron" name="chevron-right" size={14} />
                </button>
              </li>
            )}
            {others.map((ranking, index) => (
              <li key={ranking.profile.id} className="list-item">
                <button className="list-row" onClick={() => push(`/shakes/${ranking.profile.id}`)}>
                  <ShakeRankingRow
                    rank={index + (leader ? 2 : 1)}
                    ranking={ranking}
                    isCurrentUser={ranking.profile.id === currentUserID}
                    thumbURL={publicURL(client, ranking.profile.photo_thumb_path)}
                  />
                  <Icon className="list-chevron" name="chevron-right" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Recorder({ detector, myTotals, isSaving }) {
  const { currentCount, isShaking, lastBurst, sensor } = detector;
  // Without an accelerometer, the whole card is the shake button (Device ▸ Shake in the iOS app's Simulator).
  const tappable = sensor === 'unavailable';
  const content = (
    <>
      {isShaking ? (
        <>
          <span className="recorder-count">{currentCount.toLocaleString()}</span>
          <span className="recorder-hint">Shaking…</span>
        </>
      ) : (
        <>
          <Icon className="recorder-icon" name="phone-vibrate" size={40} />
          <span className="recorder-hint">
            {tappable ? 'Tap here (or press Space) for each shake' : 'Shake your phone to start counting'}
          </span>
        </>
      )}
      {lastBurst ? (
        <span className="recorder-last">
          {isSaving && <Spinner />}
          Last: {lastBurst.count} shakes in {shakeDurationText(lastBurst.durationMS)}
          {lastBurst.motion && <BurstMotion motion={lastBurst.motion} />}
        </span>
      ) : (
        myTotals && (
          <span className="recorder-last">
            Last: {myTotals.last_shake_count} shakes in {shakeDurationText(myTotals.last_duration_ms)}
          </span>
        )
      )}
      {myTotals && (
        <span className="recorder-total">
          {myTotals.total_shakes.toLocaleString()} shakes total across {myTotals.session_count} bursts
        </span>
      )}
    </>
  );

  // Space counts a shake too, on a keyboard.
  useEffect(() => {
    if (!tappable) return undefined;
    const onKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat || event.target.closest?.('input, textarea, button')) return;
      event.preventDefault();
      detector.registerShake();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [tappable, detector.registerShake]);

  return tappable ? (
    <button className="recorder recorder-tappable" onClick={() => detector.registerShake()} aria-label="Shake">
      {content}
    </button>
  ) : (
    <div className="recorder" aria-live="polite">
      {content}
    </div>
  );
}

/** "· Firm, ⇅ up and down" after the last burst. */
function BurstMotion({ motion }) {
  const pattern = shakePattern(motion.pattern);
  return (
    <>
      <span>· {intensityLabel(motion.averageAcceleration)},</span>
      {pattern && (
        <span className="icon-label">
          <Icon name={pattern.icon} size={12} />
          {pattern.label.toLowerCase()}
        </span>
      )}
    </>
  );
}

/** What's needed for motion to reach the page, under the recorder (the iOS app's section footer). */
function SensorFooter({ detector }) {
  if (detector.sensor === 'needsPermission') {
    return (
      <div className="section-footer sensor-permission">
        <span>This browser asks before a page can read the motion sensor.</span>
        <button className="button button-prominent" onClick={detector.requestPermission}>
          Allow Motion
        </button>
      </div>
    );
  }
  if (detector.sensor === 'denied') {
    return (
      <p className="section-footer">
        Motion access was turned down. Reload the page to be asked again, or allow it in the browser&apos;s site
        settings.
      </p>
    );
  }
  if (detector.sensor === 'unavailable') {
    return <p className="section-footer">No accelerometer here: each tap on the card counts as one shake.</p>;
  }
  return null;
}

function ShakeRankingRow({ rank, ranking, isCurrentUser, thumbURL }) {
  const { profile, totals } = ranking;
  return (
    <span className="profile-row">
      <span className="rank">{rank}</span>
      <Avatar url={thumbURL ?? profile.avatar_url} size={36} />
      <span className="profile-row-text">
        <span className="profile-row-name">
          <span className="profile-name">{profileName(profile)}</span>
          {isCurrentUser && <span className="you-badge">You</span>}
        </span>
        <span className="profile-active">
          {totals
            ? `Last: ${totals.last_shake_count} in ${shakeDurationText(totals.last_duration_ms)} · ${relativeTime(totals.last_shake_at)}`
            : 'No shakes yet'}
        </span>
      </span>
      <span className="rank-total">{totalShakes(ranking).toLocaleString()}</span>
    </span>
  );
}

const JIGGLE = {
  keyframes: [
    { transform: 'rotate(0deg) scale(1)', offset: 0 },
    { transform: 'rotate(-6deg) scale(1.05)', offset: 0.14 },
    { transform: 'rotate(6deg) scale(1.08)', offset: 0.35 },
    { transform: 'rotate(-4deg) scale(1.05)', offset: 0.55 },
    { transform: 'rotate(3deg) scale(1.02)', offset: 0.76 },
    { transform: 'rotate(0deg) scale(1)', offset: 1 },
  ],
  options: { duration: 490, easing: 'ease-in-out' },
};

const BOUNCE = {
  keyframes: [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-18%) scale(1.15)' },
    { transform: 'translateY(0) scale(1)' },
  ],
  options: { duration: 400, easing: 'cubic-bezier(0.3, 1.6, 0.6, 1)' },
};

/**
 * The top-ranked user, shown large at the head of the leaderboard (about a quarter of the
 * screen). Jiggles, and its crown bounces, each time `jiggle` changes.
 */
function LeaderCard({ ranking, isCurrentUser, photoURL, jiggle }) {
  const { profile, totals } = ranking;
  const card = useRef(null);
  const crown = useRef(null);
  useEffect(() => {
    if (jiggle === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    card.current?.animate?.(JIGGLE.keyframes, JIGGLE.options);
    crown.current?.animate?.(BOUNCE.keyframes, BOUNCE.options);
  }, [jiggle]);

  const total = totalShakes(ranking);
  return (
    <span className="leader-card" ref={card} aria-label={`Leader: ${profileName(profile)}, ${total} shakes`}>
      <span className="leader-photo">
        <Avatar url={photoURL ?? profile.avatar_url} size="100%" />
        <span className="leader-crown" ref={crown}>
          <Icon name="crown-fill" size="100%" />
        </span>
      </span>
      <span className="leader-text">
        <span className="profile-row-name">
          <span className="leader-rank">#1</span>
          {isCurrentUser && <span className="you-badge">You</span>}
        </span>
        <span className="leader-name">{profileName(profile)}</span>
        <span className="leader-total">{total.toLocaleString()}</span>
        {totals && <span className="profile-active">shakes · last {relativeTime(totals.last_shake_at)}</span>}
      </span>
    </span>
  );
}
