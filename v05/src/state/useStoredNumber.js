import { useStoredValue } from './useStoredValue.js';

function parseNumber(raw, defaultValue) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * A number kept in localStorage under `key`, standing in for SwiftUI's `@AppStorage` with a
 * `Double`. Falls back to `defaultValue` when storage is unavailable or holds something that
 * isn't a number.
 */
export function useStoredNumber(key, defaultValue) {
  return useStoredValue(key, defaultValue, parseNumber);
}
