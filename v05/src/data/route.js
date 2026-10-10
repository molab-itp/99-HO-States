import { AppScreen } from './appScreen.js';

// Page links: each screen has its own path under the app's base (`News`, `List`, `Credits`,
// `Speech`, and `HOS/NN` for one head of state), so a location in the app can be bookmarked or
// shared. This is not a router — `appModel.screen` and `slideIndex` still decide what shows; the
// address bar is just kept in step with them, and read once on load (and on browser Back/Forward).
const SCREEN_PATHS = {
  [AppScreen.hosList]: 'List',
  [AppScreen.news]: 'News',
  [AppScreen.credits]: 'Credits',
  [AppScreen.speechSetup]: 'Speech',
};
const HOS_PREFIX = 'HOS/';
const APP_TITLE = 'HOS-USnA';

// The path of `screen` (showing `hos`, for the detail screen) relative to the app's base. Landing
// is the base itself, ''.
export function routePath(screen, hos) {
  if (screen === AppScreen.hosDetail && hos) return `${HOS_PREFIX}${String(hos.order).padStart(2, '0')}`;
  return SCREEN_PATHS[screen] ?? '';
}

// Every path besides the base — what the build writes a copy of index.html for (see
// vite.config.js), so each one loads directly from a static host.
export function allRoutePaths(hosList) {
  return [...Object.values(SCREEN_PATHS), ...hosList.map((hos) => routePath(AppScreen.hosDetail, hos))];
}

// The screen (and, for `HOS/NN`, the index into `hosList`) a relative path names, or null for the
// base or a path that names nothing. Forgiving about case, a trailing slash and `.html`.
export function parseRoutePath(path, hosList) {
  const name = path.replace(/^\/+|\/+$/g, '').replace(/(^|\/)index\.html$/i, '').replace(/\.html$/i, '').toLowerCase();
  if (name.startsWith(HOS_PREFIX.toLowerCase())) {
    const order = Number(name.slice(HOS_PREFIX.length));
    const slideIndex = hosList.findIndex((hos) => hos.order === order);
    return slideIndex >= 0 ? { screen: AppScreen.hosDetail, slideIndex } : null;
  }
  const screen = Object.keys(SCREEN_PATHS).find((key) => SCREEN_PATHS[key].toLowerCase() === name);
  return screen ? { screen } : null;
}

// `parseRoutePath` for the page's current address.
export function routeFromLocation(hosList) {
  const base = import.meta.env.BASE_URL;
  const { pathname } = window.location;
  // Also matches the base without its trailing slash (`/99-HO-States/v05`).
  if (!`${pathname}/`.startsWith(base)) return null;
  return parseRoutePath(pathname.slice(base.length), hosList);
}

// Puts `screen` (and `hos`) in the address bar and the page title. `push` adds a history entry, so
// the browser's Back returns to the screen before; otherwise the current entry is rewritten, which
// is what stepping through heads of state does, so a slideshow doesn't bury Back under one entry
// per slide.
export function showRoute(screen, hos, push) {
  const path = routePath(screen, hos);
  const pageName = screen === AppScreen.hosDetail && hos ? `#${hos.order} ${hos.name}` : path;
  document.title = pageName ? `${pageName} · ${APP_TITLE}` : APP_TITLE;

  const url = `${import.meta.env.BASE_URL}${path}`;
  if (url === window.location.pathname) return;
  try {
    const target = `${url}${window.location.search}${window.location.hash}`;
    if (push) window.history.pushState(null, '', target);
    else window.history.replaceState(null, '', target);
  } catch {
    // History unavailable or rate-limited (Safari caps how often it can be written) — the address
    // just lags behind until the next change.
  }
}
