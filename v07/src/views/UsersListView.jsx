import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Admins (`public.admins`) can check rows and delete those users from the Actions menu. */
  const [isAdmin, setIsAdmin] = useState(false);
  /** The checked rows' ids, which the Actions menu works on. */
  const [selection, setSelection] = useState(() => new Set());
  /** Up while the "are you sure" dialog for deleting the checked users is showing. */
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
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

  // Whether rows show checkboxes. Delete is the only action so far, and it's admin-only;
  // widen this when actions any user can take are added to the menu.
  const canSelect = isAdmin;

  // Drop checks for users who are gone (e.g. deleted by another admin), and all of them when
  // checkboxes go away.
  useEffect(() => {
    setSelection((current) => {
      const kept = canSelect ? [...current].filter((id) => profiles.some((p) => p.id === id)) : [];
      return kept.length === current.size ? current : new Set(kept);
    });
  }, [profiles, canSelect]);

  /** The checked users Delete applies to: never the signed-in user. */
  const deletableSelection = useMemo(
    () => profiles.filter((p) => selection.has(p.id) && p.id !== currentUserID),
    [profiles, selection, currentUserID],
  );

  function toggleSelected(id) {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Deletes one at a time and keeps going past failures, so one bad row doesn't block the rest. */
  async function confirmDelete() {
    const users = deletableSelection;
    setIsConfirmingDelete(false);
    const failures = [];
    for (const profile of users) {
      try {
        await deleteUser(client, profile.id);
        // Realtime removes the row too; this covers live updates being off.
        setProfiles(profilesRef.current.filter((p) => p.id !== profile.id));
        setSelection((current) => {
          const next = new Set(current);
          next.delete(profile.id);
          return next;
        });
      } catch (error) {
        failures.push(`${profileName(profile)}: ${error.message}`);
      }
    }
    setErrorMessage(failures.length === 0 ? null : failures.join('\n'));
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
          onProfileChanged={reload}
        />
      ) : (
        <>
          <NavBar
            title="HOS-Lobby"
            leading={
              <>
                {/* Pull-to-refresh, for a browser. */}
                <button className="nav-button" onClick={reload} disabled={isReloading} aria-label="Refresh">
                  <Icon name="arrow-clockwise" size={18} />
                </button>
                {canSelect && (
                  <ActionsMenu
                    selectedCount={selection.size}
                    totalCount={profiles.length}
                    deletableCount={deletableSelection.length}
                    onSelectAll={() => setSelection(new Set(profiles.map((p) => p.id)))}
                    onDeselectAll={() => setSelection(new Set())}
                    onDelete={() => setIsConfirmingDelete(true)}
                  />
                )}
              </>
            }
            trailing={
              <button className="nav-button" onClick={signOut}>
                Sign Out
              </button>
            }
          />
          <div className="list-screen">
            {shownError && <p className="error-text list-error">{shownError}</p>}
            {/* v06's section header. */}
            <div className="list-header">
              <AppVersionLabel small />
              {hasLoaded && profiles.length > 0 && <UserCounts profiles={profiles} />}
            </div>
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
              <ul className={canSelect ? 'list list-selectable' : 'list'}>
                {profiles.map((profile) => (
                  <li key={profile.id} className="list-item">
                    {canSelect && (
                      <Checkbox
                        isSelected={selection.has(profile.id)}
                        name={profileName(profile)}
                        onToggle={() => toggleSelected(profile.id)}
                      />
                    )}
                    <button className="list-row" onClick={() => openProfile(profile.id)}>
                      <ProfileRow
                        profile={profile}
                        isCurrentUser={profile.id === currentUserID}
                        thumbURL={publicURL(client, profile.photo_thumb_path)}
                      />
                      <Icon className="list-chevron" name="chevron-right" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {isConfirmingDelete && deletableSelection.length > 0 && (
        <div className="dialog-backdrop" onClick={() => setIsConfirmingDelete(false)}>
          <div className="dialog" role="alertdialog" aria-labelledby="delete-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="delete-title">
              {deletableSelection.length === 1
                ? `Delete ${profileName(deletableSelection[0])}?`
                : `Delete ${deletableSelection.length} users?`}
            </h2>
            <p>Their accounts, photos and saved data are removed for good.</p>
            <button className="button button-destructive button-large" onClick={confirmDelete}>
              {deletableSelection.length === 1 ? 'Delete User' : `Delete ${deletableSelection.length} Users`}
            </button>
            <button className="button button-bordered button-large" onClick={() => setIsConfirmingDelete(false)}>
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

/** A row's checkbox. Separate from the row's button, so a tap on it doesn't also open the profile. */
function Checkbox({ isSelected, name, onToggle }) {
  return (
    <button
      className={isSelected ? 'list-check list-check-on' : 'list-check'}
      onClick={onToggle}
      aria-label={isSelected ? `Deselect ${name}` : `Select ${name}`}
      aria-pressed={isSelected}
    >
      <Icon name={isSelected ? 'check-circle-fill' : 'circle'} size={22} />
    </button>
  );
}

/** Operations on the checked users, as v06's toolbar Menu. New ones go below the selection controls. */
function ActionsMenu({ selectedCount, totalCount, deletableCount, onSelectAll, onDeselectAll, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Each item closes the menu, as a SwiftUI Menu does.
  const choose = (action) => () => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="menu">
      <button
        className="nav-button menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Icon name="three-dots-circle" size={18} />
        {selectedCount === 0 ? 'Actions' : `Actions (${selectedCount})`}
      </button>
      {isOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setIsOpen(false)} />
          <div className="menu-popover" role="menu">
            <button className="menu-item" role="menuitem" onClick={choose(onSelectAll)} disabled={selectedCount === totalCount}>
              Select All
              <Icon name="check-circle" size={18} />
            </button>
            <button className="menu-item" role="menuitem" onClick={choose(onDeselectAll)} disabled={selectedCount === 0}>
              Deselect All
              <Icon name="circle" size={18} />
            </button>
            <div className="menu-divider" />
            <button
              className="menu-item menu-item-destructive"
              role="menuitem"
              onClick={choose(onDelete)}
              disabled={deletableCount === 0}
            >
              {deletableCount === 0 ? 'Delete' : `Delete (${deletableCount})`}
              <Icon name="trash" size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Totals shown above the list: every user, and those seen in the last 24 hours. Ticks each
 * minute so users drop out of the 24-hour count without a reload.
 */
function UserCounts({ profiles }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const cutoff = now - 24 * 60 * 60 * 1000;
  const activeCount = profiles.filter((p) => timeOf(p.last_seen_at) > cutoff).length;
  return (
    <div className="user-counts">
      <UserCount title="Total Users" value={profiles.length} />
      <div className="user-counts-divider" />
      <UserCount title="Active in 24h" value={activeCount} />
    </div>
  );
}

function UserCount({ title, value }) {
  return (
    <p className="user-count">
      <span className="user-count-value">{value.toLocaleString()}</span> {title}
    </p>
  );
}
