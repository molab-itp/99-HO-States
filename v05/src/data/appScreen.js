// Port of AppScreen.swift: the app's top-level screens. `AppModel`'s `screen` records whichever
// one is showing so it can be restored on the next launch; `landing` is the navigation root, the
// others are pushed onto it.
export const AppScreen = {
  landing: 'landing',
  hosList: 'hosList',
  hosDetail: 'hosDetail',
  news: 'news',
  credits: 'credits',
};

// A saved value this build doesn't know (or none at all, from an older save) falls back to Landing.
export function normalizeAppScreen(value) {
  return Object.values(AppScreen).includes(value) ? value : AppScreen.landing;
}
