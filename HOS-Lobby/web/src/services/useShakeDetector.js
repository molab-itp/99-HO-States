// Port of ShakeDetector.swift, on the browser's `devicemotion` events instead of Core Motion.
import { useCallback, useEffect, useRef, useState } from 'react';

const G = 9.80665;
/** In g. A firm wrist shake peaks around 2–3 g; walking stays under 1. */
const THRESHOLD = 1.6;
/** Jolts closer than this are one shake (a single flick spikes several samples). */
const MIN_GAP_MS = 200;
/** A burst ends after this long with no shake. */
const BURST_TIMEOUT_MS = 1200;
/** With no motion data this soon after listening starts, the device has no accelerometer. */
const SENSOR_PROBE_MS = 1500;

/**
 * Whether motion events can reach the page:
 * - `needsPermission`: iOS Safari, until the user taps to allow motion access
 * - `checking`: listening, waiting for the first sample
 * - `on`: samples are arriving
 * - `denied`: the user said no
 * - `unavailable`: no accelerometer (a desktop browser), so `registerShake()` is the only input
 */
function initialSensorState() {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return 'unavailable';
  // iOS Safari. Desktop Chromium has `requestPermission` too, but no sensor to ask about; a
  // touch screen tells them apart.
  if (typeof window.DeviceMotionEvent.requestPermission === 'function' && navigator.maxTouchPoints > 0) {
    return 'needsPermission';
  }
  return 'checking';
}

/** Gravity-free acceleration magnitude in g, or `null` if the event carries no data. */
function magnitudeOf(event) {
  const a = event.acceleration;
  if (a && a.x != null && a.y != null && a.z != null) return Math.hypot(a.x, a.y, a.z) / G;
  // Some Android browsers only fill in the gravity-included reading.
  const g = event.accelerationIncludingGravity;
  if (g && g.x != null && g.y != null && g.z != null) return Math.abs(Math.hypot(g.x, g.y, g.z) - G) / G;
  return null;
}

/**
 * Counts shakes and groups them into bursts while `active`. Each finished burst
 * `{ count, startedAt: Date, durationMS }` goes to `onBurstEnded`. Going inactive (leaving the
 * screen, or the page going to the background) finishes any burst in progress, so it isn't lost.
 *
 * Returns `{ currentCount, isShaking, lastBurst, sensor, requestPermission, registerShake }`.
 */
export function useShakeDetector({ active, onBurstEnded }) {
  const [currentCount, setCurrentCount] = useState(0);
  const [lastBurst, setLastBurst] = useState(null);
  const [sensor, setSensor] = useState(initialSensorState);

  const burst = useRef({ count: 0, start: null, lastShakeAt: null });
  const timeout = useRef(null);
  const onBurstEndedRef = useRef(onBurstEnded);
  onBurstEndedRef.current = onBurstEnded;

  const finishBurst = useCallback(() => {
    clearTimeout(timeout.current);
    timeout.current = null;
    const { count, start, lastShakeAt } = burst.current;
    burst.current = { count: 0, start: null, lastShakeAt: null };
    setCurrentCount(0);
    if (count === 0 || start == null) return;
    const finished = { count, startedAt: new Date(start), durationMS: Math.round((lastShakeAt ?? start) - start) };
    setLastBurst(finished);
    onBurstEndedRef.current?.(finished);
  }, []);

  const registerShake = useCallback(
    (now = performance.timeOrigin + performance.now()) => {
      const current = burst.current;
      if (current.lastShakeAt != null && now - current.lastShakeAt < MIN_GAP_MS) return;
      if (current.start == null) current.start = now;
      current.count += 1;
      current.lastShakeAt = now;
      setCurrentCount(current.count);
      // `.sensoryFeedback(.impact(weight: .light))`, where the browser can.
      navigator.vibrate?.(10);
      clearTimeout(timeout.current);
      timeout.current = setTimeout(finishBurst, BURST_TIMEOUT_MS);
    },
    [finishBurst],
  );

  const listening = active && (sensor === 'checking' || sensor === 'on' || sensor === 'unavailable');

  useEffect(() => {
    if (!listening || !('DeviceMotionEvent' in window)) return undefined;
    let sawData = false;
    const onMotion = (event) => {
      const magnitude = magnitudeOf(event);
      if (magnitude == null) return;
      if (!sawData) {
        sawData = true;
        setSensor('on');
      }
      if (magnitude > THRESHOLD) registerShake();
    };
    window.addEventListener('devicemotion', onMotion);
    const probe = setTimeout(() => {
      if (!sawData) setSensor((s) => (s === 'checking' ? 'unavailable' : s));
    }, SENSOR_PROBE_MS);
    return () => {
      window.removeEventListener('devicemotion', onMotion);
      clearTimeout(probe);
    };
  }, [listening, registerShake]);

  // Leaving the screen or backgrounding the page finishes the burst in progress.
  useEffect(() => {
    if (!active) finishBurst();
  }, [active, finishBurst]);
  useEffect(() => () => clearTimeout(timeout.current), []);

  /** iOS asks once per site; this must run from a tap. */
  const requestPermission = useCallback(async () => {
    try {
      const answer = await window.DeviceMotionEvent.requestPermission();
      setSensor(answer === 'granted' ? 'checking' : 'denied');
    } catch {
      setSensor('denied');
    }
  }, []);

  return { currentCount, isShaking: currentCount > 0, lastBurst, sensor, requestPermission, registerShake };
}
