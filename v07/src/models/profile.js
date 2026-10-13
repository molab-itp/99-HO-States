// Port of Profile.swift. A profile here is a row of `public.profiles` as supabase-js returns it,
// so fields keep their column names (`display_name`, `photo_thumb_path`, `last_seen_at`, …) and
// timestamps are ISO strings.

/** Guests have no email, so a slice of their id tells them apart in the list. */
export function profileName(profile) {
  return (
    profile.display_name ??
    profile.email ??
    // Uppercase to match v06, where `UUID.uuidString` is.
    (profile.is_anonymous ? `Guest ${profile.id.slice(0, 4).toUpperCase()}` : 'Unknown user')
  );
}

/** Milliseconds since the epoch, or `-Infinity` for a missing timestamp (Swift's `.distantPast`). */
export function timeOf(timestamp) {
  return timestamp ? Date.parse(timestamp) : -Infinity;
}

/** Same order as `fetchAll`: most recently active first, never-seen last. */
export function sortedByLastSeen(profiles) {
  return [...profiles].sort((a, b) => {
    const [ta, tb] = [timeOf(a.last_seen_at), timeOf(b.last_seen_at)];
    return ta === tb ? 0 : tb > ta ? 1 : -1;
  });
}

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "5 minutes ago", "yesterday", "now": Swift's `.relative(presentation: .named)`. */
export function relativeTime(timestamp, now = Date.now()) {
  const seconds = (Date.parse(timestamp) - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return relativeFormat.format(0, 'second');
}
