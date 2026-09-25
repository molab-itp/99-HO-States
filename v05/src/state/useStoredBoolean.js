import { useCallback, useState } from 'react';

/**
 * A boolean kept in localStorage under `key`, standing in for SwiftUI's `@AppStorage`. Falls back
 * to `defaultValue` (and just doesn't persist) when storage is unavailable.
 */
export function useStoredBoolean(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? defaultValue : raw === 'true';
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = useCallback(
    (next) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Storage unavailable — the setting just won't survive a reload.
      }
    },
    [key],
  );

  return [value, setStoredValue];
}
