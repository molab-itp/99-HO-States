// Port of ShakeDeviceInfo.swift: what's saved with each burst in `shake_sessions.device` (a
// `jsonb` object, snake_case keys). Every field is optional, so bursts saved before a field
// existed still read. The browser can't see everything iOS can: no hardware model (except some
// Android browsers), no Low Power Mode, battery only in Chromium, and its altitude is above the
// WGS 84 ellipsoid, so it's saved as `ellipsoidal_altitude`. `browser` is web-only.
import { rounded } from './shakeMotion.js';

const has = (value) => value != null && !Number.isNaN(value);

/** Whether the burst was saved with coordinates. */
export function hasLocation(device) {
  return has(device?.latitude) && has(device?.longitude);
}

/**
 * A snapshot of this device now, plus `position` (a `GeolocationPosition`) if there is one, and
 * the finished burst from `useShakeDetector`.
 */
export async function currentDeviceInfo(position, burst) {
  const motion = burst.motion;
  const system = systemInfo();
  const result = {
    peak_acceleration: burst.peakAcceleration != null ? rounded(burst.peakAcceleration) : undefined,
    average_acceleration: motion ? rounded(motion.averageAcceleration) : undefined,
    rms_acceleration: motion ? rounded(motion.rmsAcceleration) : undefined,
    pattern: motion?.pattern,
    axis_share: motion
      ? Object.fromEntries(Object.entries(motion.axisShare).map(([axis, share]) => [axis, rounded(share)]))
      : undefined,
    circularity: motion ? rounded(motion.circularity) : undefined,
    shakes: burst.shakes.map(({ t, peak, axis }) => ({
      t: rounded(t),
      ...(peak != null && { peak: rounded(peak) }),
      ...(axis && { axis }),
    })),
    model: (await highEntropyModel()) || system.deviceKind,
    device_kind: system.deviceKind,
    system_name: system.name,
    system_version: system.version,
    browser: system.browser,
    app_version: __APP_VERSION__,
    app_build: __APP_BUILD__,
    ...(await batteryInfo()),
    locale: navigator.language,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const coords = position?.coords;
  if (coords && coords.accuracy >= 0) {
    Object.assign(result, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      horizontal_accuracy: coords.accuracy,
      location_timestamp: new Date(position.timestamp).toISOString(),
    });
    if (has(coords.altitude)) {
      result.ellipsoidal_altitude = coords.altitude;
      if (has(coords.altitudeAccuracy)) result.vertical_accuracy = coords.altitudeAccuracy;
    }
    if (has(coords.speed) && coords.speed >= 0) result.speed = coords.speed;
    if (has(coords.heading) && coords.heading >= 0) result.course = coords.heading;
  }
  // JSON drops the `undefined`s.
  return JSON.parse(JSON.stringify(result));
}

/** The phone model ("Pixel 8"), where the browser shares it (Chromium on Android). */
async function highEntropyModel() {
  try {
    const values = await navigator.userAgentData?.getHighEntropyValues(['model']);
    return values?.model || null;
  } catch {
    return null;
  }
}

/** `{ battery_level, battery_state }` where the browser reports them (Chromium), else `{}`. */
async function batteryInfo() {
  try {
    if (!navigator.getBattery) return {};
    const battery = await navigator.getBattery();
    let state = 'unknown';
    if (battery.charging) state = battery.level >= 1 ? 'full' : 'charging';
    else state = 'unplugged';
    return { battery_level: rounded(battery.level), battery_state: state };
  } catch {
    return {};
  }
}

/** Best guesses from the user agent: `{ deviceKind, name, version, browser }`. */
function systemInfo(ua = navigator.userAgent) {
  const version = (re) => ua.match(re)?.[1]?.replace(/_/g, '.');
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  let deviceKind;
  let name;
  let osVersion;
  if (/iPhone/.test(ua) || isIPad) {
    deviceKind = isIPad ? 'iPad' : 'iPhone';
    name = isIPad ? 'iPadOS' : 'iOS';
    osVersion = version(/OS (\d+[_.]\d+(?:[_.]\d+)?)/) ?? version(/Version\/(\d+(?:\.\d+)*)/);
  } else if (/Android/.test(ua)) {
    deviceKind = 'Android';
    name = 'Android';
    osVersion = version(/Android (\d+(?:\.\d+)*)/);
  } else if (/Macintosh/.test(ua)) {
    deviceKind = 'Mac';
    name = 'macOS';
  } else if (/Windows/.test(ua)) {
    deviceKind = 'PC';
    name = 'Windows';
  } else if (/CrOS/.test(ua)) {
    deviceKind = 'Chromebook';
    name = 'ChromeOS';
  } else if (/Linux/.test(ua)) {
    deviceKind = 'PC';
    name = 'Linux';
  }

  let browser;
  const edge = version(/Edg\w*\/(\d+)/);
  const firefox = version(/(?:Firefox|FxiOS)\/(\d+)/);
  const chrome = version(/(?:Chrome|CriOS)\/(\d+)/);
  const safari = version(/Version\/(\d+(?:\.\d+)?)/);
  if (edge) browser = `Edge ${edge}`;
  else if (firefox) browser = `Firefox ${firefox}`;
  else if (chrome) browser = `Chrome ${chrome}`;
  else if (safari && /Safari/.test(ua)) browser = `Safari ${safari}`;

  return { deviceKind, name, version: osVersion, browser };
}
