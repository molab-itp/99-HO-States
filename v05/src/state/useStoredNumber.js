import { useCallback, useState } from 'react';

/**
 * A number kept in localStorage under `key`, standing in for SwiftUI's `@AppStorage` with a
 * `Double`. Falls back to `defaultValue` (and just doesn't persist) when storage is unavailable
 * or holds something that isn't a number.
 */
export function useStoredNumber(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw === null ? NaN : Number(raw);
      return Number.isFinite(parsed) ? parsed : defaultValue;
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
