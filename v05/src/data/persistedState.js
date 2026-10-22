// Port of AppModel.swift's `PersistedState`/`persistState()`/`loadPersistedState()`, backed by
// localStorage instead of a JSON file in the app support directory. Same fields (`slideIndex`,
// `screen`, the shuffle state, `reactions`, `imageZoomStates`, `drawingDisplayModes`, `greatestShownAt`) and the same "not
// `viewedIDs`/`cycleCount`" omission, for the same reason: enough to resume browsing and keep
// feedback across reloads, without making "Reset Visit Count" behave inconsistently across sessions.
// One addition, `greatestIndex`: the figure `GreatestDetailScreen` reopens on, which v2 doesn't keep.
const STORAGE_KEY = 'ho-states-us.appState.v1';

export function loadPersistedState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePersistedState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private browsing, quota, ...) — resuming state just won't persist.
  }
}
