import { useCallback, useSyncExternalStore } from 'react';

// The `NavigationStack` path, kept in the address so the browser's Back button works and any
// screen can be bookmarked:
//
//   (no hash)          HomeView
//   #/users            UsersListView
//   #/user/<id>        ProfileDetailView (its parent is #/users)
//   #/shakes           ShakesView
//   #/shakes/<id>      ShakeHistoryView (its parent is #/shakes)
//   #/shakes/<id>/<sessionID>
//                      ShakeSessionDetailView (its parent is #/shakes/<id>)

const NAVIGATE = 'hos-navigate';

function parse(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'users') return { name: 'users' };
  if (parts[0] === 'user' && parts[1]) return { name: 'user', id: parts[1] };
  if (parts[0] === 'shakes') {
    if (parts[1] && parts[2]) return { name: 'shakeSession', id: parts[1], sessionID: parts[2] };
    return parts[1] ? { name: 'shakeHistory', id: parts[1] } : { name: 'shakes' };
  }
  return { name: 'home' };
}

/** Where Back goes from a route that was opened directly, with nothing in the app to go back to. */
function parentPath(route) {
  if (route.name === 'user') return '/users';
  if (route.name === 'shakeHistory') return '/shakes';
  if (route.name === 'shakeSession') return `/shakes/${route.id}`;
  return '';
}

function subscribe(onChange) {
  window.addEventListener('popstate', onChange);
  window.addEventListener('hashchange', onChange);
  window.addEventListener(NAVIGATE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener(NAVIGATE, onChange);
  };
}

const getHash = () => window.location.hash;

function go(path, replace) {
  const target = path ? `#${path}` : window.location.pathname + window.location.search;
  // `depth` counts the screens pushed inside the app, so Back knows whether `history.back()`
  // stays in the app or would leave it.
  const depth = (window.history.state?.depth ?? 0) + (replace ? 0 : 1);
  if (replace) window.history.replaceState({ depth }, '', target);
  else window.history.pushState({ depth }, '', target);
  window.dispatchEvent(new Event(NAVIGATE));
}

/**
 * Returns `{ route, push, back }`. `route` is `{ name, id?, sessionID? }`; `push('/shakes')` opens a screen;
 * `back()` is the navigation bar's Back button: one step back in history if the screen was opened
 * from inside the app, otherwise (a bookmark or reload) a replace with the screen's parent.
 */
export function useRoute() {
  const hash = useSyncExternalStore(subscribe, getHash);
  const route = parse(hash);

  const push = useCallback((path) => go(path, false), []);
  const back = useCallback(() => {
    const current = parse(window.location.hash);
    if ((window.history.state?.depth ?? 0) > 0) window.history.back();
    else go(parentPath(current), true);
  }, []);

  return { route, push, back };
}
