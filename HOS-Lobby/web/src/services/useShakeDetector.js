// Port of ShakeDetector.swift, on the browser's `devicemotion` events instead of Core Motion.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShakeMotionAnalyzer, mainAxis, makeSample } from '../models/shakeMotion.js';

const G = 9.80665;
/** In g. A firm wrist shake peaks around 2–3 g; walking stays under 1. */
const THRESHOLD = 1.6;
/** Jolts closer than this are one shake (a single flick spikes several samples). */
const MIN_GAP_MS = 200;
/** A burst ends after this long with no shake. */
const BURST_TIMEOUT_MS = 1200;
/** With no motion data this soon after listening starts, the device has no accelerometer. */
const SENSOR_PROBE_MS = 1500;
/** Caps the per-shake list saved with a burst. */
const MAX_SHAKES_SAVED = 300;
/** Low-pass weight for estimating gravity where the browser gives only the gravity-included reading. */
const GRAVITY_FILTER = 0.9;

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

const vector = (v) => (v && v.x != null && v.y != null && v.z != null ? [v.x / G, v.y / G, v.z / G] : null);

/**
 * The event as a motion sample (see `makeSample`) whose `magnitude` is the gravity-free
 * acceleration in g, or `null` if the event carries no data. `gravityEstimate` is a ref holding
 * a running estimate, for browsers without the gravity-free reading.
 */
function sampleOf(event, time, gravityEstimate) {
  const user = vector(event.acceleration);
  const withGravity = vector(event.accelerationIncludingGravity);
  if (user) {
    const gravity = withGravity && withGravity.map((v, i) => v - user[i]);
    return makeSample(user, gravity, time);
  }
  // Some Android browsers only fill in the gravity-included reading: separate gravity with a
  // low-pass filter for the direction, and keep the old magnitude for counting.
  if (!withGravity) return null;
  const previous = gravityEstimate.current ?? withGravity;
  const gravity = previous.map((v, i) => GRAVITY_FILTER * v + (1 - GRAVITY_FILTER) * withGravity[i]);
  gravityEstimate.current = gravity;
  const sample = makeSample(withGravity.map((v, i) => v - gravity[i]), gravity, time);
  sample.magnitude = Math.abs(Math.hypot(...withGravity) - 1);
  return sample;
}

const now = () => performance.timeOrigin + performance.now();

const idleBurst = () => ({ count: 0, start: null, lastShakeAt: null, peak: null, shakes: [] });

/**
 * Counts shakes and groups them into bursts while `active`. Each finished burst
 * `{ count, startedAt: Date, durationMS, peakAcceleration, motion, shakes }` goes to
 * `onBurstEnded`: `peakAcceleration` (g) and `motion` (`ShakeMotionAnalyzer.summary`) are `null`
 * for tapped shakes, and `shakes` holds `{ t, peak, axis }` per shake as saved in
 * `shake_sessions.device.shakes` (`t` in seconds since the first shake). Going inactive (leaving the
 * screen, or the page going to the background) finishes any burst in progress, so it isn't lost.
 *
 * Returns `{ currentCount, isShaking, lastBurst, sensor, requestPermission, registerShake }`.
 */
export function useShakeDetector({ active, onBurstEnded }) {
  const [currentCount, setCurrentCount] = useState(0);
  const [lastBurst, setLastBurst] = useState(null);
  const [sensor, setSensor] = useState(initialSensorState);

  const burst = useRef(idleBurst());
  const analyzer = useRef(new ShakeMotionAnalyzer());
  const gravityEstimate = useRef(null);
  const timeout = useRef(null);
  const onBurstEndedRef = useRef(onBurstEnded);
  onBurstEndedRef.current = onBurstEnded;

  const finishBurst = useCallback(() => {
    clearTimeout(timeout.current);
    timeout.current = null;
    const { count, start, lastShakeAt, peak, shakes } = burst.current;
    burst.current = idleBurst();
    setCurrentCount(0);
    const samples = analyzer.current;
    analyzer.current = new ShakeMotionAnalyzer();
    if (count === 0 || start == null) return;
    const last = lastShakeAt ?? start;
    // The burst's motion runs until its last shake has played out, not to the timeout.
    const motion = samples.summary(
      last + MIN_GAP_MS,
      shakes.map((s) => s.peak).filter((p) => p != null),
    );
    const finished = {
      count,
      startedAt: new Date(start),
      durationMS: Math.round(last - start),
      peakAcceleration: peak,
      motion,
      shakes,
    };
    setLastBurst(finished);
    onBurstEndedRef.current?.(finished);
  }, []);

  /** Counts a jolt at `time` (ms). `sample` is `null` for a tap or Space, which has no motion. */
  const registerShake = useCallback(
    (time = now(), sample = null) => {
      const current = burst.current;
      const magnitude = sample?.magnitude ?? null;
      // Every jolt counts toward the peak, even ones too close together to be a new shake.
      if (magnitude != null) current.peak = Math.max(current.peak ?? 0, magnitude);
      if (current.lastShakeAt != null && time - current.lastShakeAt < MIN_GAP_MS) {
        // Part of the shake just counted: keep that shake's strongest jolt.
        const shake = current.shakes.at(-1);
        if (sample && shake && magnitude > (shake.peak ?? 0)) {
          shake.peak = magnitude;
          shake.axis = mainAxis(sample);
        }
        return;
      }
      if (current.start == null) {
        current.start = time;
        analyzer.current.reset();
        if (sample) analyzer.current.add(sample);
      }
      if (current.shakes.length < MAX_SHAKES_SAVED) {
        current.shakes.push({ t: (time - current.start) / 1000, peak: magnitude, axis: sample ? mainAxis(sample) : null });
      }
      current.count += 1;
      current.lastShakeAt = time;
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
      const time = now();
      const sample = sampleOf(event, time, gravityEstimate);
      if (sample == null) return;
      if (!sawData) {
        sawData = true;
        setSensor('on');
      }
      // Only samples during a burst are kept; the one that starts a burst is added by registerShake.
      if (burst.current.count > 0) analyzer.current.add(sample);
      if (sample.magnitude > THRESHOLD) registerShake(time, sample);
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
