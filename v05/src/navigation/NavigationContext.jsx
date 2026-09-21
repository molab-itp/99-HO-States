import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const NavigationContext = createContext(null);

let navKeySeq = 0;
function nextNavKey() {
  navKeySeq += 1;
  return navKeySeq;
}

/**
 * A minimal stack navigator standing in for SwiftUI's `NavigationStack` + `NavigationPath`.
 * Deliberately has no dependency on the DOM (no history/URL syncing) so the same hook could
 * back a React Native stack navigator later: screens only ever push/pop/replace this array.
 *
 * Path entries mirror HomeView's `path`: `{ type: 'list' }` or `{ type: 'detail', president }`,
 * each tagged with a unique `navKey` used to force a fresh screen instance per push (the React
 * equivalent of SwiftUI's `.id(president.id)` on the detail destination).
 */
export function NavigationProvider({ children }) {
  const [path, setPath] = useState([]);
  const pathRef = useRef(path);
  pathRef.current = path;

  const pushList = useCallback(() => {
    setPath((prev) => [...prev, { type: 'list', navKey: nextNavKey() }]);
  }, []);

  const pushDetail = useCallback((president) => {
    setPath((prev) => [...prev, { type: 'detail', president, navKey: nextNavKey() }]);
  }, []);

  // Mirrors HomeView.goToRandomPresident(): replaces the *entire* path with a single detail
  // entry, used by both the Home "Random Head" button and the slideshow.
  const replaceWithDetail = useCallback((president) => {
    if (!president) return;
    setPath([{ type: 'detail', president, navKey: nextNavKey() }]);
  }, []);

  const pop = useCallback(() => {
    setPath((prev) => prev.slice(0, -1));
  }, []);

  const popToRoot = useCallback(() => setPath([]), []);

  const value = useMemo(
    () => ({ path, pushList, pushDetail, replaceWithDetail, pop, popToRoot }),
    [path, pushList, pushDetail, replaceWithDetail, pop, popToRoot],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
}
