import { useCallback, useEffect, useState } from 'react';

// Every mounted hook for a key listens here, so a write from one instance (e.g. a picker on
// Landing) updates any others mounted at the same time, the way every `@AppStorage`
// for the same key stays in sync in SwiftUI. Works without storage too, for the session. Each
// listener is `{ setValue, reset }`, `reset` putting that hook back to its own default.
const listeners = new Map();

function read(key, defaultValue, parse) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? defaultValue : parse(raw, defaultValue);
  } catch {
    return defaultValue;
  }
}

/**
 * A value kept in localStorage under `key`, standing in for SwiftUI's `@AppStorage`. `parse`
 * turns the stored string back into a value (falling back to `defaultValue`). Falls back to
 * `defaultValue` (and just doesn't persist) when storage is unavailable.
 */
export function useStoredValue(key, defaultValue, parse) {
  const [value, setValue] = useState(() => read(key, defaultValue, parse));

  useEffect(() => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    const set = listeners.get(key);
    const listener = { setValue, reset: () => setValue(defaultValue) };
    set.add(listener);
    return () => set.delete(listener);
  }, [key, defaultValue]);

  const setStoredValue = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Storage unavailable — the setting just won't survive a reload.
      }
      for (const listener of listeners.get(key) ?? [{ setValue }]) listener.setValue(next);
    },
    [key],
  );

  return [value, setStoredValue];
}

/**
 * Removes `keys` from storage and puts every mounted hook for them back to its default, like
 * `UserDefaults.removeObject(forKey:)` under an `@AppStorage`. For Landing's Reset App.
 */
export function removeStoredValues(keys) {
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage unavailable — nothing was saved there to remove.
    }
    for (const listener of listeners.get(key) ?? []) listener.reset();
  }
}
