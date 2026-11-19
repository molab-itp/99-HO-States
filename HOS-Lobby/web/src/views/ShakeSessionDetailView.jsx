// Port of ShakeSessionDetailView.swift: everything saved with one burst — its intensity,
// direction, each shake, where it happened and on what device. Bursts saved before a field
// existed just leave that part out.
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import { hasLocation } from '../models/shakeDeviceInfo.js';
import { AXIS_LABELS, SHAKE_AXES, SHAKE_PATTERNS, gText, intensityLabel, shakePattern } from '../models/shakeMotion.js';
import { formatDateTime, shakeDurationText } from '../models/shakeSession.js';

const number = (digits) =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const oneDecimal = number(1);
const twoDecimals = number(2);
const fiveDecimals = number(5);
const upToOneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

const meters = (value) => `${upToOneDecimal.format(value)} m`;

export default function ShakeSessionDetailView({ session, onBack }) {
  const device = session.device ?? {};
  const shakes = device.shakes ?? [];
  const seconds = session.duration_ms / 1000;
  const pattern = shakePattern(device.pattern);
  const intensity = device.average_acceleration ?? device.peak_acceleration;
  const strongest = Math.max(0, ...shakes.map((s) => s.peak ?? 0));
  const altitude = device.altitude ?? device.ellipsoidal_altitude;

  return (
    <div className="app-shell">
      <NavBar title={`${session.shake_count} Shakes`} onBack={onBack} />
      <div className="list-screen">
        <h2 className="section-header">Burst</h2>
        <ul className="list">
          <Stat title="Started" value={formatDateTime(session.started_at)} />
          <Stat title="Shakes" value={session.shake_count.toLocaleString()} />
          <Stat title="Duration" value={shakeDurationText(session.duration_ms)} />
          {seconds > 0 && (
            <Stat title="Pace" value={`${oneDecimal.format((session.shake_count - 1) / seconds)} shakes/s`} />
          )}
        </ul>

        {(device.peak_acceleration != null || device.average_acceleration != null) && (
          <>
            <h2 className="section-header">Intensity</h2>
            <ul className="list">
              {intensity != null && <Stat title="Intensity" value={intensityLabel(intensity)} />}
              {device.peak_acceleration != null && <Stat title="Strongest jolt" value={gText(device.peak_acceleration)} />}
              {device.average_acceleration != null && (
                <Stat title="Average shake" value={gText(device.average_acceleration)} />
              )}
              {device.rms_acceleration != null && <Stat title="Sustained (RMS)" value={gText(device.rms_acceleration)} />}
            </ul>
            <p className="section-footer">In g, with gravity removed. A shake counts from 1.6 g.</p>
          </>
        )}

        {pattern && (
          <>
            <h2 className="section-header">Direction</h2>
            <ul className="list">
              <li className="list-item stat-row detail-pattern">
                <Icon name={pattern.icon} size={18} />
                {pattern.label}
              </li>
              {device.axis_share &&
                SHAKE_AXES.map((axis) => (
                  <ShareBar key={axis} title={AXIS_LABELS[axis]} value={device.axis_share[axis] ?? 0} />
                ))}
              {device.circularity != null && <ShareBar title="Turning" value={device.circularity} />}
            </ul>
            <p className="section-footer">
              Up/down is along gravity; left/right is across the phone&apos;s screen; forward/back is toward or away from
              you. Turning is how steadily the motion went around one way.
            </p>
          </>
        )}

        <h2 className="section-header">
          {shakes.length > 0 && shakes.length < session.shake_count ? `Each shake (first ${shakes.length})` : 'Each shake'}
        </h2>
        <ul className="list list-plain">
          {shakes.length === 0 ? (
            <li className="list-item stat-row section-empty">Per-shake detail wasn&apos;t recorded for this burst.</li>
          ) : (
            shakes.map((shake, index) => (
              <ShakeRow
                key={index}
                number={index + 1}
                shake={shake}
                gap={index > 0 ? shake.t - shakes[index - 1].t : null}
                strongest={strongest}
              />
            ))
          )}
        </ul>

        {hasLocation(device) && (
          <>
            <h2 className="section-header">Location</h2>
            <ul className="list">
              <Stat
                title="Coordinates"
                value={`${fiveDecimals.format(device.latitude)}, ${fiveDecimals.format(device.longitude)}`}
              />
              {device.horizontal_accuracy != null && <Stat title="Accuracy" value={meters(device.horizontal_accuracy)} />}
              {altitude != null && <Stat title="Altitude" value={meters(altitude)} />}
              {device.floor != null && <Stat title="Floor" value={String(device.floor)} />}
              {device.speed != null && <Stat title="Speed" value={`${oneDecimal.format(device.speed)} m/s`} />}
            </ul>
          </>
        )}

        {device.model != null && (
          <>
            <h2 className="section-header">Device</h2>
            <ul className="list">
              <Stat title="Model" value={device.model} />
              {device.system_name != null && (
                <Stat title="System" value={[device.system_name, device.system_version].filter(Boolean).join(' ')} />
              )}
              {device.browser != null && <Stat title="Browser" value={device.browser} />}
              {device.app_version != null && (
                <Stat
                  title="App"
                  value={device.app_build ? `${device.app_version} (${device.app_build})` : device.app_version}
                />
              )}
              {device.battery_level != null && (
                <Stat
                  title="Battery"
                  value={`${percent.format(device.battery_level)}${device.battery_state ? `, ${device.battery_state}` : ''}`}
                />
              )}
              {device.low_power_mode === true && <Stat title="Low Power Mode" value="On" />}
              {device.time_zone != null && <Stat title="Time zone" value={device.time_zone} />}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** `LabeledContent`. */
function Stat({ title, value }) {
  return (
    <li className="list-item stat-row">
      <span>{title}</span>
      <span className="stat-value">{value}</span>
    </li>
  );
}

/** A labeled 0–1 value as a percentage and a bar. */
function ShareBar({ title, value }) {
  const clamped = Math.min(Math.max(value, 0), 1);
  return (
    <li className="list-item share-bar">
      <span className="share-bar-label">
        <span>{title}</span>
        <span className="stat-value">{percent.format(value)}</span>
      </span>
      <progress className="bar" value={clamped} max={1} aria-label={title} />
    </li>
  );
}

function ShakeRow({ number: n, shake, gap, strongest }) {
  const axis = shake.axis && SHAKE_PATTERNS[shake.axis] ? shake.axis : null;
  return (
    <li className="list-item shake-row">
      <span className="shake-number">{n}</span>
      <span className="shake-timing">
        <span>
          +{twoDecimals.format(shake.t)} s
          {gap != null && <span className="shake-gap"> ({twoDecimals.format(gap)} s after)</span>}
        </span>
        {shake.peak != null && strongest > 0 && (
          <progress
            className={shake.peak === strongest ? 'bar bar-strongest' : 'bar'}
            value={shake.peak / strongest}
            max={1}
            aria-hidden="true"
          />
        )}
      </span>
      <span className="shake-strength">
        {shake.peak != null && <span className="shake-peak">{gText(shake.peak)}</span>}
        {axis && (
          <span className="icon-label shake-axis">
            <Icon name={SHAKE_PATTERNS[axis].icon} size={11} />
            {AXIS_LABELS[axis]}
          </span>
        )}
      </span>
    </li>
  );
}
