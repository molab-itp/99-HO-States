// Port of ShakeHistoryView.swift: one user's shake totals and every burst they've recorded; tap a
// burst for its details. Users can delete their own bursts, one at a time or all at once.
import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import Spinner from '../components/Spinner.jsx';
import { profileName } from '../models/profile.js';
import { gText, intensityLabel, shakePattern } from '../models/shakeMotion.js';
import { formatDateTime, shakeDurationText } from '../models/shakeSession.js';
import { useAuth } from '../services/AuthContext.jsx';
import { clearStats, deleteSession, fetchHistory } from '../services/shakesService.js';
import ShakeSessionDetailView from './ShakeSessionDetailView.jsx';

/**
 * `onChange` is called after a delete, so the leaderboard catches up. With `sessionID`, shows that
 * burst's details instead (the iOS app's `navigationDestination`); `onOpenSession` opens one.
 */
export default function ShakeHistoryView({ profile, isCurrentUser, sessionID, onOpenSession, onBack, onChange }) {
  const { client } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSessions(await fetchHistory(client, profile.id));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error.message);
    }
    setHasLoaded(true);
  }, [client, profile.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function remove(session) {
    setSessions((current) => current.filter((s) => s.id !== session.id));
    try {
      await deleteSession(client, session.id);
    } catch (error) {
      setErrorMessage(error.message);
      await reload();
    }
    await onChange();
  }

  /** Every burst in one request, which also takes the user off the leaderboard. */
  async function clearAll() {
    setIsConfirmingClear(false);
    setSessions([]);
    try {
      await clearStats(client, [profile.id]);
    } catch (error) {
      setErrorMessage(error.message);
      await reload();
    }
    await onChange();
  }

  const total = sessions.reduce((sum, s) => sum + s.shake_count, 0);
  const totalMS = sessions.reduce((sum, s) => sum + s.duration_ms, 0);
  const best = sessions.reduce((max, s) => (max == null || s.shake_count > max.shake_count ? s : max), null);
  const last = sessions[0];
  const peaks = sessions.map((s) => s.device?.peak_acceleration).filter((g) => g != null);
  const strongest = peaks.length > 0 ? Math.max(...peaks) : null;
  const favorite = favoritePattern(sessions);

  if (sessionID) {
    const session = sessions.find((s) => s.id === sessionID);
    if (session) return <ShakeSessionDetailView session={session} onBack={onBack} />;
    return (
      <div className="app-shell">
        <NavBar title="" onBack={onBack} />
        <div className="unavailable">{hasLoaded ? <h1>No such burst</h1> : <Spinner large />}</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <NavBar
        title={profileName(profile)}
        onBack={onBack}
        leading={
          <button className="nav-button" onClick={reload} aria-label="Refresh">
            <Icon name="arrow-clockwise" size={18} />
          </button>
        }
        trailing={
          isCurrentUser &&
          sessions.length > 0 && (
            <button
              className="nav-button nav-button-destructive"
              onClick={() => setIsConfirmingClear(true)}
              aria-label="Delete All Shakes"
            >
              <Icon name="trash" size={18} />
            </button>
          )
        }
      />
      <div className="list-screen">
        {errorMessage && <p className="error-text list-error">{errorMessage}</p>}
        {!hasLoaded ? (
          <div className="unavailable">
            <Spinner large />
          </div>
        ) : sessions.length === 0 ? (
          !errorMessage && (
            <div className="unavailable">
              <Icon name="phone-vibrate" size={48} />
              <h1>No shakes yet</h1>
            </div>
          )
        ) : (
          <>
            <h2 className="section-header">Summary</h2>
            <ul className="list">
              <Stat title="Total shakes" value={total.toLocaleString()} />
              <Stat title="Bursts" value={sessions.length.toLocaleString()} />
              <Stat title="Total time shaking" value={shakeDurationText(totalMS)} />
              <Stat title="Biggest burst" value={`${best.shake_count} in ${shakeDurationText(best.duration_ms)}`} />
              <Stat title="Last burst" value={`${last.shake_count} in ${shakeDurationText(last.duration_ms)}`} />
              {strongest != null && <Stat title="Strongest jolt" value={gText(strongest)} />}
              {favorite && <Stat title="Usual direction" value={favorite.label} />}
            </ul>

            <h2 className="section-header">History</h2>
            <ul className="list list-plain">
              {sessions.map((session) => (
                <li key={session.id} className="list-item history-item">
                  <button className="list-row history-row" onClick={() => onOpenSession(session)}>
                    <HistoryRow session={session} />
                    <Icon className="list-chevron" name="chevron-right" size={14} />
                  </button>
                  {/* The iOS app swipes to delete; a browser gets a button. */}
                  {isCurrentUser && (
                    <button
                      className="history-delete"
                      onClick={() => remove(session)}
                      aria-label={`Delete ${session.shake_count} shakes at ${formatDateTime(session.started_at)}`}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {isConfirmingClear && sessions.length > 0 && (
        <div className="dialog-backdrop" onClick={() => setIsConfirmingClear(false)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-labelledby="clear-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="clear-history-title">Delete all your shake stats?</h2>
            <p>This removes every burst you've recorded and takes you off the leaderboard.</p>
            <button className="button button-destructive button-large" onClick={clearAll}>
              Delete {sessions.length} Bursts
            </button>
            <button className="button button-bordered button-large" onClick={() => setIsConfirmingClear(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The most common pattern among bursts that have one, other than undetermined. */
function favoritePattern(sessions) {
  const counts = new Map();
  for (const session of sessions) {
    const pattern = shakePattern(session.device?.pattern);
    if (pattern && pattern.id !== 'undetermined') counts.set(pattern.id, (counts.get(pattern.id) ?? 0) + 1);
  }
  let best = null;
  for (const [id, count] of counts) if (best == null || count > counts.get(best)) best = id;
  return shakePattern(best);
}

function HistoryRow({ session }) {
  const g = session.device?.average_acceleration ?? session.device?.peak_acceleration;
  const pattern = shakePattern(session.device?.pattern);
  return (
    <>
      <span className="history-when">
        <span>{formatDateTime(session.started_at)}</span>
        <span className="history-duration">
          {shakeDurationText(session.duration_ms)}
          {g != null && ` · ${intensityLabel(g)}`}
          {pattern && (
            <span role="img" aria-label={pattern.label}>
              <Icon name={pattern.icon} size={11} />
            </span>
          )}
        </span>
      </span>
      <span className="history-count">{session.shake_count} shakes</span>
    </>
  );
}

/** `LabeledContent`. */
function Stat({ title, value }) {
  return (
    <li className="list-item stat-row">
      <span>{title}</span>
      <span className="stat-value">{value}</span>
    </li>
  );
}
