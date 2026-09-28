import { useCallback, useEffect, useState } from 'react';

// Every mounted hook for a key listens here, so a write from one instance (e.g. a picker in the
// Settings sheet) updates the others (the detail screen underneath) the way every `@AppStorage`
// for the same key stays in sync in SwiftUI. Works without storage too, for the session.
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
    set.add(setValue);
    return () => set.delete(setValue);
  }, [key]);

  const setStoredValue = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Storage unavailable — the setting just won't survive a reload.
      }
      for (const setOne of listeners.get(key) ?? [setValue]) setOne(next);
    },
    [key],
  );

  return [value, setStoredValue];
}
