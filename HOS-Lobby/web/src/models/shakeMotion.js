// Port of ShakeMotion.swift: how hard and which way a burst was shaken, worked out from its
// accelerometer samples. Saved values use the iOS app's raw strings ("up_down", …), so bursts
// recorded on either app read the same.

/** `ShakePattern`: the overall direction of a burst. `icon` names an Icon.jsx entry. */
export const SHAKE_PATTERNS = {
  up_down: { label: 'Up and down', icon: 'arrow-down-up' },
  left_right: { label: 'Left and right', icon: 'arrow-left-right' },
  forward_back: { label: 'Forward and back', icon: 'arrows-angle-expand' },
  circle: { label: 'In circles', icon: 'arrow-repeat' },
  undetermined: { label: 'Undetermined', icon: 'question' },
};

/** The pattern for a saved raw value, or `null` for a missing or unknown one. */
export function shakePattern(raw) {
  return raw && SHAKE_PATTERNS[raw] ? { id: raw, ...SHAKE_PATTERNS[raw] } : null;
}

/**
 * `ShakeAxis`: one axis of motion, relative to the ground and to how the phone is held. Up/down is
 * along gravity, left/right is along the phone's width (its height when held sideways) laid flat,
 * and forward/back is the remaining horizontal direction, toward or away from the user. Each axis's
 * pattern has the same raw value.
 */
export const SHAKE_AXES = ['up_down', 'left_right', 'forward_back'];

export const AXIS_LABELS = { up_down: 'Up/down', left_right: 'Left/right', forward_back: 'Forward/back' };

/** `ShakeIntensity`: a name for a shake's strength in g. Shakes only count above 1.6 g. */
export function intensityLabel(g) {
  if (g < 2.2) return 'Gentle';
  if (g < 3.2) return 'Firm';
  if (g < 4.5) return 'Strong';
  return 'Vigorous';
}

const twoDecimals = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "2.45 g" */
export function gText(g) {
  return `${twoDecimals.format(g)} g`;
}

/** Two decimals is plenty, and keeps the saved JSON small. */
export function rounded(value) {
  return Math.round(value * 100) / 100;
}

/** One linear axis must carry at least this share of the energy to name the burst after it. */
const LINEAR_SHARE = 0.6;
/** A circle needs its two main axes this balanced (smaller / larger)… */
const CIRCLE_BALANCE = 0.35;
/** …and to turn the same way at least this consistently. */
const CIRCLE_CONSISTENCY = 0.5;
/** About 30 s at 60 Hz; longer bursts keep their first 30 s. */
const MAX_SAMPLES = 1800;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (v) => Math.hypot(v[0], v[1], v[2]);
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const flatten = (v, down) => subtract(v, scale(down, dot(v, down)));

/** The axis carrying most of `sample`. */
export function mainAxis(sample) {
  return SHAKE_AXES.reduce((best, axis) => (Math.abs(sample[axis]) > Math.abs(sample[best]) ? axis : best));
}

/**
 * `ShakeMotionAnalyzer.sample`: splits `userAcceleration` into axes relative to `gravity` and the
 * phone's width. Both are `[x, y, z]` in g in the device's frame; `gravity` may point up or down,
 * since only each axis's energy and turning are used. `time` is in ms.
 * Returns `{ time, up_down, left_right, forward_back, magnitude }`.
 */
export function makeSample(userAcceleration, gravity, time) {
  const a = userAcceleration;
  const magnitude = length(a);
  const gravityLength = gravity ? length(gravity) : 0;
  if (gravityLength <= 0.1) {
    // No usable gravity (free fall, or the browser gave none): fall back to the phone's own axes.
    return { time, up_down: a[1], left_right: a[0], forward_back: a[2], magnitude };
  }
  const down = scale(gravity, 1 / gravityLength);
  // The phone's width, laid flat. Held sideways the width points up, so use its height.
  let across = flatten([1, 0, 0], down);
  if (length(across) < 0.3) across = flatten([0, 1, 0], down);
  across = scale(across, 1 / length(across));
  const ahead = cross(down, across);
  return { time, up_down: dot(a, down), left_right: dot(a, across), forward_back: dot(a, ahead), magnitude };
}

/** Collects a burst's samples and classifies the burst when it ends. */
export class ShakeMotionAnalyzer {
  samples = [];

  add(sample) {
    if (this.samples.length < MAX_SAMPLES) this.samples.push(sample);
  }

  reset() {
    this.samples = [];
  }

  /**
   * Summarizes the samples up to `end` (ms), given each shake's peak; `null` without enough
   * samples. Returns `{ averageAcceleration, rmsAcceleration, pattern, axisShare, circularity }`
   * with `pattern` a raw value and `axisShare` keyed by axis.
   */
  summary(end, shakePeaks) {
    const used = this.samples.filter((s) => s.time <= end);
    if (used.length < 6 || shakePeaks.length === 0) return null;

    const energy = {};
    for (const axis of SHAKE_AXES) energy[axis] = used.reduce((sum, s) => sum + s[axis] * s[axis], 0);
    const total = SHAKE_AXES.reduce((sum, axis) => sum + energy[axis], 0);
    if (!(total > 0)) return null;
    const axisShare = Object.fromEntries(SHAKE_AXES.map((axis) => [axis, energy[axis] / total]));
    const [first, second] = [...SHAKE_AXES].sort((a, b) => energy[b] - energy[a]);

    // Turning: the cross product of consecutive samples in the plane of the two main axes is
    // positive when the motion turns one way and negative the other. A circle keeps one sign; a
    // line or a jumble mixes them.
    let signed = 0;
    let unsigned = 0;
    for (let i = 1; i < used.length; i++) {
      const [prev, next] = [used[i - 1], used[i]];
      const turn = prev[first] * next[second] - prev[second] * next[first];
      signed += turn;
      unsigned += Math.abs(turn);
    }
    const circularity = unsigned > 0 ? Math.abs(signed) / unsigned : 0;

    let pattern = 'undetermined';
    if (axisShare[first] >= LINEAR_SHARE) pattern = first;
    else if (energy[second] / energy[first] >= CIRCLE_BALANCE && circularity >= CIRCLE_CONSISTENCY) pattern = 'circle';

    return {
      averageAcceleration: shakePeaks.reduce((sum, p) => sum + p, 0) / shakePeaks.length,
      rmsAcceleration: Math.sqrt(total / used.length),
      pattern,
      axisShare,
      circularity,
    };
  }
}
