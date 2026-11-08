import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import { useAppModel } from '../state/AppModelContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { exportAppState, latestAppState } from './appStateHistory.js';
import { fetchAllProfiles, profileName, publicURL } from './profilesService.js';
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
 * Port of v2's Account/AccountView.swift: the Account screen pushed from `LandingScreen`, like
 * News. `SignInView` while signed out, otherwise who is signed in (with their profile photo),
 * Export/Import of the app state (see `appStateHistory.js`), and the other users with an Import
 * action for each one's latest export. The Sign Out button sits under who is signed in. `auth` is
 * `null` when the Supabase project isn't set up, which only happens here when the screen was
 * restored from an earlier visit.
 */
export default function AccountScreen({ onBack }) {
  const auth = useAuth();

  return (
    <div className="screen-scroll list-screen account-screen">
      <NavBar title="Account" onBack={onBack} />
      <div className="list-group">
        {!auth && <p className="account-loading">Account Unavailable</p>}
        {auth?.state.status === 'loading' && <p className="account-loading">Loading…</p>}
        {auth?.state.status === 'signedOut' && <SignInView />}
        {auth?.state.status === 'signedIn' && <SignedIn user={auth.state.user} />}
      </div>
    </div>
  );
}

/** A round profile photo, or a placeholder symbol while loading or when there's none. */
function ProfileImage({ url, size }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <span className="profile-image" style={{ width: size, height: size }}>
      {url && !failed ? (
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        <Icon name="person-circle" size={size} />
      )}
    </span>
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
  /** Everyone in `profiles`, most recently active first, the signed-in user included; empty until loaded. */
  const [profiles, setProfiles] = useState([]);
  const [profilesError, setProfilesError] = useState(null);

  const me = profiles.find((profile) => profile.id === user.id);
  const others = profiles.filter((profile) => profile.id !== user.id);

  // The uploaded photo's thumbnail, else the avatar from sign-in (if any).
  const profilePhotoURL = (profile) =>
    profile ? (publicURL(auth.client, profile.photo_thumb_path) ?? profile.avatar_url ?? null) : null;

  const loadLastExport = useCallback(async () => {
    try {
      setLastExportAt((await latestAppState(auth.client, user.id))?.savedAt ?? null);
    } catch {
      setLastExportAt(null);
    }
  }, [auth.client, user.id]);

  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(await fetchAllProfiles(auth.client));
      setProfilesError(null);
    } catch (error) {
      setProfilesError(`Couldn't load users: ${error.message}`);
    }
  }, [auth.client]);

  useEffect(() => {
    loadLastExport();
    loadProfiles();
  }, [loadLastExport, loadProfiles, user.id]);

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

  // Merges `profile`'s latest export, reporting the result under App State. Leaves
  // `lastExportAt` alone, since that's this user's own export.
  const importStateFrom = (profile) =>
    transfer(async () => {
      const name = profileName(profile);
      try {
        const entry = await latestAppState(auth.client, profile.id);
        if (entry) {
          merge(entry.snapshot);
          setTransferMessage(`Merged ${name}'s export from ${dateFormat.format(entry.savedAt)}.`);
        } else {
          setTransferMessage(`${name} hasn't exported yet.`);
        }
      } catch (error) {
        setTransferMessage(`Import failed: ${error.message}`);
      }
    });

  return (
    <div className="account">
      <div className="account-photo">
        <ProfileImage url={profilePhotoURL(me)} size={96} />
      </div>

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

      <section>
        <h2 className="section-header">Other Users</h2>
        <fieldset className="plain-fieldset" disabled={isTransferring}>
          <ul className="hos-list other-users">
            {others.map((profile) => (
              <li key={profile.id} className="other-user-row">
                <ProfileImage url={profilePhotoURL(profile)} size={40} />
                <span className="names">
                  <span className="label">{profileName(profile)}</span>
                  {profile.caption && <span className="caption">{profile.caption}</span>}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Import from ${profileName(profile)}`}
                  onClick={() => importStateFrom(profile)}
                >
                  <Icon name="box-arrow-in-down" size={20} />
                </button>
              </li>
            ))}
            {profilesError ? (
              <li className="labeled-row secondary">{profilesError}</li>
            ) : (
              others.length === 0 && <li className="labeled-row secondary">No other users yet.</li>
            )}
          </ul>
        </fieldset>
        <p className="credits-footer">
          Import merges that user's most recent export into this browser, the same way as Import App State.
        </p>
      </section>

      {auth.errorMessage && (
        <ul className="hos-list">
          <li className="labeled-row error-text">{auth.errorMessage}</li>
        </ul>
      )}
    </div>
  );
}
