import { useStoredValue } from './useStoredValue.js';

const parseString = (raw) => raw;

/**
 * A string kept in localStorage under `key`, standing in for SwiftUI's `@AppStorage`. Falls back
 * to `defaultValue` when storage is unavailable.
 */
export function useStoredString(key, defaultValue) {
  return useStoredValue(key, defaultValue, parseString);
}
