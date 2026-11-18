// Port of ShakeHistoryView.swift: one user's shake totals and every burst they've recorded.
// Users can delete their own bursts, one at a time or all at once.
import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import Spinner from '../components/Spinner.jsx';
import { profileName } from '../models/profile.js';
import { formatDateTime, shakeDurationText } from '../models/shakeSession.js';
import { useAuth } from '../services/AuthContext.jsx';
import { clearStats, deleteSession, fetchHistory } from '../services/shakesService.js';

/** `onChange` is called after a delete, so the leaderboard catches up. */
export default function ShakeHistoryView({ profile, isCurrentUser, onBack, onChange }) {
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
            </ul>

            <h2 className="section-header">History</h2>
            <ul className="list list-plain">
              {sessions.map((session) => (
                <li key={session.id} className="list-item history-row">
                  <span className="history-when">
                    <span>{formatDateTime(session.started_at)}</span>
                    <span className="history-duration">{shakeDurationText(session.duration_ms)}</span>
                  </span>
                  <span className="history-count">{session.shake_count} shakes</span>
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

/** `LabeledContent`. */
function Stat({ title, value }) {
  return (
    <li className="list-item stat-row">
      <span>{title}</span>
      <span className="stat-value">{value}</span>
    </li>
  );
}
