import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/Icon.jsx';
import { useAppModel } from '../state/AppModelContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { exportAppState, latestAppState } from './appStateHistory.js';
import SignInView from './SignInView.jsx';

/** The slice of the user id that tells guests apart in the lobby; uppercase like v2's `uuidString`. */
export function guestCode(user) {
  return user.id.slice(0, 4).toUpperCase();
}

/**
 * The email, or the name Apple gave on first sign-in, or "Guest XXXX" as the HO Users lobby
 * shows it (`profileName` in v07).
 */
export function displayName(user) {
  if (user.email) return user.email;
  if (user.user_metadata?.full_name) return user.user_metadata.full_name;
  return `Guest ${guestCode(user)}`;
}

function method(user) {
  if (user.is_anonymous) return 'Guest';
  switch (user.app_metadata?.provider) {
    case 'apple':
      return 'Sign in with Apple';
    case 'email':
      return 'Email code';
    case undefined:
      return 'Unknown';
    default:
      return user.app_metadata.provider;
  }
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Port of v2's Account/AccountView.swift: the Account sheet opened from `LandingScreen`.
 * `SignInView` while signed out, otherwise who is signed in, Export/Import of the app state (see
 * `appStateHistory.js`), and a Sign Out button. Portaled like `EmojiPickerSheet`.
 */
export default function AccountSheet({ onClose }) {
  const auth = useAuth();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet account-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <span className="sheet-title">Account</span>
          <button type="button" className="sheet-done" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet-body">
          {auth.state.status === 'loading' && <p className="account-loading">Loading…</p>}
          {auth.state.status === 'signedOut' && <SignInView />}
          {auth.state.status === 'signedIn' && <SignedIn user={auth.state.user} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SignedIn({ user }) {
  const auth = useAuth();
  const { snapshot, merge } = useAppModel();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  /** When the user's most recent export was saved, from any device; `null` if none or not loaded. */
  const [lastExportAt, setLastExportAt] = useState(null);
  const [transferMessage, setTransferMessage] = useState(null);

  const loadLastExport = useCallback(async () => {
    try {
      setLastExportAt((await latestAppState(auth.client, user.id))?.savedAt ?? null);
    } catch {
      setLastExportAt(null);
    }
  }, [auth.client, user.id]);

  useEffect(() => {
    loadLastExport();
  }, [loadLastExport, user.id]);

  async function transfer(action) {
    setIsTransferring(true);
    setTransferMessage(null);
    await action();
    setIsTransferring(false);
  }

  const exportState = () =>
    transfer(async () => {
      try {
        await exportAppState(auth.client, snapshot());
        setTransferMessage('Exported.');
        await loadLastExport();
      } catch (error) {
        setTransferMessage(`Export failed: ${error.message}`);
      }
    });

  const importState = () =>
    transfer(async () => {
      try {
        const entry = await latestAppState(auth.client, user.id);
        if (entry) {
          merge(entry.snapshot);
          setLastExportAt(entry.savedAt);
          setTransferMessage(`Merged the export from ${dateFormat.format(entry.savedAt)}.`);
        } else {
          setTransferMessage('Nothing to import yet. Export first, on this or another device.');
        }
      } catch (error) {
        setTransferMessage(`Import failed: ${error.message}`);
      }
    });

  return (
    <div className="account">
      <section>
        <ul className="hos-list">
          <li className="labeled-row">
            <span>Signed in as</span>
            <span className="value">{displayName(user)}</span>
          </li>
          <li className="labeled-row">
            <span>Method</span>
            <span className="value">{method(user)}</span>
          </li>
          {user.is_anonymous && (
            <li className="labeled-row">
              <span>Guest code</span>
              <span className="value mono">{guestCode(user)}</span>
            </li>
          )}
        </ul>
        <p className="credits-footer">
          {user.is_anonymous
            ? `You'll appear in the HO Users lobby as ${displayName(user)}.`
            : "You'll appear in the HO Users lobby."}
        </p>
      </section>

      <section>
        <h2 className="section-header">App State</h2>
        <fieldset className="plain-fieldset" disabled={isTransferring}>
          <ul className="hos-list">
            <li>
              <button type="button" className="action-row" onClick={exportState}>
                <Icon name="box-arrow-up" />
                Export App State
              </button>
            </li>
            <li>
              <button type="button" className="action-row" onClick={importState}>
                <Icon name="box-arrow-in-down" />
                Import App State
              </button>
            </li>
            {lastExportAt && (
              <li className="labeled-row">
                <span>Last export</span>
                <span className="value">{dateFormat.format(lastExportAt)}</span>
              </li>
            )}
            {transferMessage && <li className="labeled-row secondary">{transferMessage}</li>}
          </ul>
        </fieldset>
        <p className="credits-footer">
          Export saves your reactions, zoom, drawing display choices and Greatest progress as a new dated copy;
          earlier copies are kept. Import merges the most recent copy into this browser. Drawings and your place in
          the slideshow stay on this browser.
        </p>
      </section>

      {auth.errorMessage && (
        <ul className="hos-list">
          <li className="labeled-row error-text">{auth.errorMessage}</li>
        </ul>
      )}

      <ul className="hos-list">
        <li>
          <button
            type="button"
            className="action-row destructive"
            disabled={isSigningOut}
            onClick={async () => {
              setIsSigningOut(true);
              await auth.signOut();
              setIsSigningOut(false);
            }}
          >
            Sign Out
          </button>
        </li>
      </ul>
    </div>
  );
}
