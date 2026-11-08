import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = '#/user/';

function idFromHash() {
  const { hash } = window.location;
  return hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null;
}

/**
 * The `NavigationStack` path, kept in the address as `#/user/<id>` so the browser's Back button
 * returns to the list and a profile can be bookmarked. Returns `[id, open, close]`.
 */
export function useSelectedUser() {
  const [id, setID] = useState(idFromHash);
  /** Whether the profile was opened from the list, so going back is one step back in history. */
  const opened = useRef(false);

  useEffect(() => {
    const onHashChange = () => setID(idFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const open = useCallback((userID) => {
    opened.current = true;
    window.location.hash = PREFIX + userID;
  }, []);

  const close = useCallback(() => {
    if (opened.current) {
      opened.current = false;
      window.history.back();
    } else {
      // Arrived by a bookmark: there's no list to go back to, so just drop the hash.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setID(null);
    }
  }, []);

  return [id, open, close];
}
