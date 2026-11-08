import { AppScreen } from './appScreen.js';
import greatestList from './greatest.js';

// Page links: each screen has its own path under the app's base (`News`, `List`, `Greatest`,
// `Credits`, `Speech`, `Account`, `HOS/NN` for one head of state and `Greatest/NNN` for one Greatest figure), so a location in the app can be bookmarked or
// shared. This is not a router — `appModel.screen`, `slideIndex` and `greatestIndex` still decide what shows; the
// address bar is just kept in step with them, and read once on load (and on browser Back/Forward).
const SCREEN_PATHS = {
  [AppScreen.hosList]: 'List',
  [AppScreen.news]: 'News',
  [AppScreen.greatest]: 'Greatest',
  [AppScreen.credits]: 'Credits',
  [AppScreen.speechSetup]: 'Speech',
  [AppScreen.account]: 'Account',
};
const HOS_PREFIX = 'HOS/';
const GREATEST_PREFIX = 'Greatest/';
const APP_TITLE = 'HOS-USnA';

// The path of `screen` relative to the app's base, where `item` is the HOS (for the HOS detail
// screen) or Greatest figure (for the Greatest detail screen) it shows. Landing is the base
// itself, ''.
export function routePath(screen, item) {
  if (screen === AppScreen.hosDetail && item) return `${HOS_PREFIX}${String(item.order).padStart(2, '0')}`;
  if (screen === AppScreen.greatestDetail && item) return `${GREATEST_PREFIX}${String(item.order).padStart(3, '0')}`;
  return SCREEN_PATHS[screen] ?? '';
}

// Every path besides the base — what the build writes a copy of index.html for (see
// vite.config.js), so each one loads directly from a static host.
export function allRoutePaths(hosList) {
  return [
    ...Object.values(SCREEN_PATHS),
    ...hosList.map((hos) => routePath(AppScreen.hosDetail, hos)),
    ...greatestList.map((person) => routePath(AppScreen.greatestDetail, person)),
  ];
}

// The screen (and, for `HOS/NN`, the `slideIndex` into `hosList`, or for `Greatest/NNN` the
// `greatestIndex` into the Greatest list) a relative path names, or null for the
// base or a path that names nothing. Forgiving about case, a trailing slash and `.html`.
export function parseRoutePath(path, hosList) {
  const name = path.replace(/^\/+|\/+$/g, '').replace(/(^|\/)index\.html$/i, '').replace(/\.html$/i, '').toLowerCase();
  if (name.startsWith(HOS_PREFIX.toLowerCase())) {
    const order = Number(name.slice(HOS_PREFIX.length));
    const slideIndex = hosList.findIndex((hos) => hos.order === order);
    return slideIndex >= 0 ? { screen: AppScreen.hosDetail, slideIndex } : null;
  }
  if (name.startsWith(GREATEST_PREFIX.toLowerCase())) {
    const order = Number(name.slice(GREATEST_PREFIX.length));
    const greatestIndex = greatestList.findIndex((person) => person.order === order);
    return greatestIndex >= 0 ? { screen: AppScreen.greatestDetail, greatestIndex } : null;
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

// Puts `screen` (and `item`, as for `routePath`) in the address bar and the page title. `push` adds a history entry, so
// the browser's Back returns to the screen before; otherwise the current entry is rewritten, which
// is what stepping through heads of state (or Greatest figures) does, so a slideshow doesn't bury Back under one entry
// per slide.
export function showRoute(screen, item, push) {
  const path = routePath(screen, item);
  const showsItem = (screen === AppScreen.hosDetail || screen === AppScreen.greatestDetail) && item;
  const pageName = showsItem ? `#${item.order} ${item.name}` : path;
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
