import { useStoredValue } from './useStoredValue.js';

const parseBoolean = (raw) => raw === 'true';

/**
 * A boolean kept in localStorage under `key`, standing in for SwiftUI's `@AppStorage`. Falls back
 * to `defaultValue` when storage is unavailable.
 */
export function useStoredBoolean(key, defaultValue) {
  return useStoredValue(key, defaultValue, parseBoolean);
}
