import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import Spinner from '../components/Spinner.jsx';
import { profileName, sortedByLastSeen, timeOf } from '../models/profile.js';
import { userEvent } from '../models/userEvent.js';
import { useAuth } from '../services/AuthContext.jsx';
import { publicURL } from '../services/profilePhotoService.js';
import { deleteUser, fetchAll, isAdmin as fetchIsAdmin, observeChanges, touchLastSeen } from '../services/profilesService.js';
import AppVersionLabel from './AppVersionLabel.jsx';
import ProfileDetailView from './ProfileDetailView.jsx';
import ProfileRow from './ProfileRow.jsx';
import { useSelectedUser } from './useSelectedUser.js';

export default function UsersListView({ currentUserID }) {
  const { client, signOut } = useAuth();
  const [profiles, setProfilesState] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  /** Why live updates are off, if they are. */
  const [liveError, setLiveError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  /** The latest live event about another user; clears itself after a few seconds. */
  const [banner, setBanner] = useState(null);
  /** Admins (`public.admins`) get a Delete button on other users' rows. */
  const [isAdmin, setIsAdmin] = useState(false);
  /** The user an admin is deleting, while the "are you sure" dialog is up. */
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedID, openProfile, closeProfile] = useSelectedUser();

  // Live changes are compared with the list as it is now, so it's also kept in a ref.
  const profilesRef = useRef(profiles);
  const setProfiles = useCallback((next) => {
    profilesRef.current = next;
    setProfilesState(next);
  }, []);

  const reload = useCallback(async () => {
    setIsReloading(true);
    try {
      await touchLastSeen(client);
      setProfiles(await fetchAll(client));
      // Best effort: before the `admins` migration is pushed there is no `is_admin()`.
      setIsAdmin(await fetchIsAdmin(client).catch(() => false));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error.message);
    }
    setHasLoaded(true);
    setIsReloading(false);
  }, [client, setProfiles]);

  // On appear, and whenever the page comes back to the front (v06's `scenePhase == .active`).
  useEffect(() => {
    reload();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [reload]);

  // Keeps the list live for as long as it's on screen, and announces what other users do.
  useEffect(() => {
    const upsert = (profile) => {
      setProfiles(sortedByLastSeen([...profilesRef.current.filter((p) => p.id !== profile.id), profile]));
    };
    const announce = (kind, profile) => {
      if (profile.id !== currentUserID) setBanner(userEvent(kind, profile));
    };

    return observeChanges(
      client,
      (change) => {
        if (change.type === 'inserted') {
          upsert(change.profile);
          announce('created', change.profile);
        } else if (change.type === 'updated') {
          // Updates don't say which column changed, and most are `last_seen_at` bumps, so a
          // sign-in or sign-out is one that moves `last_sign_in_at` or `last_sign_out_at` on
          // from the copy already in the list. A new user's first sign-in counts too: their row
          // is created when the code is sent.
          const { profile } = change;
          const known = profilesRef.current.find((p) => p.id === profile.id);
          if (known) {
            if (profile.last_sign_in_at && timeOf(profile.last_sign_in_at) - timeOf(known.last_sign_in_at) > 1000) {
              announce('signedIn', profile);
            } else if (
              profile.last_sign_out_at &&
              timeOf(profile.last_sign_out_at) - timeOf(known.last_sign_out_at) > 1000
            ) {
              announce('signedOut', profile);
            }
          }
          upsert(profile);
        } else {
          // An admin deleted this account: the session is dead, so go back to sign-in.
          if (change.id === currentUserID) {
            signOut();
            return;
          }
          const deleted = profilesRef.current.find((p) => p.id === change.id);
          if (!deleted) return;
          setProfiles(profilesRef.current.filter((p) => p.id !== change.id));
          announce('deleted', deleted);
        }
      },
      setLiveError,
    );
  }, [client, currentUserID, setProfiles, signOut]);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  async function confirmDelete() {
    const profile = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteUser(client, profile.id);
      // Realtime removes the row too; this covers live updates being off.
      setProfiles(profilesRef.current.filter((p) => p.id !== profile.id));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  const selected = selectedID ? profiles.find((p) => p.id === selectedID) : null;
  // A bookmarked profile that no longer exists (or one deleted while open) falls back to the list.
  useEffect(() => {
    if (selectedID && hasLoaded && !selected) closeProfile();
  }, [selectedID, hasLoaded, selected, closeProfile]);

  const shownError = errorMessage ?? (liveError && `Live updates are off: ${liveError}`);

  return (
    <div className="app-shell">
      {selected ? (
        <ProfileDetailView
          profile={selected}
          isCurrentUser={selected.id === currentUserID}
          onBack={closeProfile}
          onPhotoChanged={reload}
        />
      ) : (
        <>
          <NavBar
            title="Signed-on Users"
            leading={
              // Pull-to-refresh, for a browser.
              <button className="nav-button" onClick={reload} disabled={isReloading} aria-label="Refresh">
                <Icon name="arrow-clockwise" size={18} />
              </button>
            }
            trailing={
              <button className="nav-button" onClick={signOut}>
                Sign Out
              </button>
            }
          />
          <div className="list-screen">
            {shownError && <p className="error-text list-error">{shownError}</p>}
            {!hasLoaded || (selectedID && !selected) ? (
              <div className="unavailable">
                <Spinner large />
              </div>
            ) : profiles.length === 0 && !errorMessage ? (
              <div className="unavailable">
                <Icon name="person-slash" size={48} />
                <h1>No users yet</h1>
              </div>
            ) : (
              <ul className="list">
                {profiles.map((profile) => (
                  <li key={profile.id} className="list-item">
                    <button className="list-row" onClick={() => openProfile(profile.id)}>
                      <ProfileRow
                        profile={profile}
                        isCurrentUser={profile.id === currentUserID}
                        thumbURL={publicURL(client, profile.photo_thumb_path)}
                      />
                      <Icon className="list-chevron" name="chevron-right" size={14} />
                    </button>
                    {/* v06's swipe action. */}
                    {isAdmin && profile.id !== currentUserID && (
                      <button
                        className="list-delete"
                        onClick={() => setPendingDelete(profile)}
                        aria-label={`Delete ${profileName(profile)}`}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <AppVersionLabel />
          </div>
        </>
      )}

      {pendingDelete && (
        <div className="dialog-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="dialog" role="alertdialog" aria-labelledby="delete-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="delete-title">Delete {profileName(pendingDelete)}?</h2>
            <p>Their account, photo and saved data are removed for good.</p>
            <button className="button button-destructive button-large" onClick={confirmDelete}>
              Delete User
            </button>
            <button className="button button-bordered button-large" onClick={() => setPendingDelete(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {banner && (
        <div key={banner.id} className="banner" role="status">
          <Icon name={banner.icon} size={18} />
          {banner.message}
        </div>
      )}
    </div>
  );
}
