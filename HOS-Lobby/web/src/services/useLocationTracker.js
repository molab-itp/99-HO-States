// Port of LocationTracker.swift, on `navigator.geolocation` instead of Core Location.
import { useEffect, useRef } from 'react';

/**
 * Keeps the latest position (with altitude, where the device has it) while `active`, so each
 * burst can be saved with where it happened. The browser asks for access the first time; if the
 * user declines, the ref stays `null` and bursts are saved without a location.
 *
 * Returns a ref whose `current` is the latest `GeolocationPosition` or `null`.
 */
export function useLocationTracker(active) {
  const latest = useRef(null);
  useEffect(() => {
    if (!active || !('geolocation' in navigator)) return undefined;
    const id = navigator.geolocation.watchPosition(
      (position) => {
        latest.current = position;
      },
      // Transient (no fix yet) or denied; either way bursts just save without a location.
      () => {},
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);
  return latest;
}
