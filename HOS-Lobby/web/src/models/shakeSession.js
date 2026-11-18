// Port of ShakeSession.swift. Rows of `public.shake_sessions` and the `shake_totals` view as
// supabase-js returns them, so fields keep their column names (`shake_count`, `duration_ms`, …)
// and timestamps are ISO strings.
import { profileName, timeOf } from './profile.js';

/**
 * Leaderboard rows `{ profile, totals }` (`totals` is `null` for users who've never shaken).
 * Most shakes first; ties go to whoever shook most recently, and never-shaken users sort by name
 * at the bottom.
 */
export function rankShakers(profiles, totals) {
  const byUser = new Map(totals.map((t) => [t.user_id, t]));
  return profiles
    .map((profile) => ({ profile, totals: byUser.get(profile.id) ?? null }))
    .sort((a, b) => {
      const diff = totalShakes(b) - totalShakes(a);
      if (diff !== 0) return diff;
      const [ta, tb] = [timeOf(a.totals?.last_shake_at), timeOf(b.totals?.last_shake_at)];
      if (ta !== tb) return tb > ta ? 1 : -1;
      return profileName(a.profile).localeCompare(profileName(b.profile), undefined, { sensitivity: 'base' });
    });
}

export function totalShakes(ranking) {
  return ranking.totals?.total_shakes ?? 0;
}

const seconds = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "2.4 s": shake bursts are short, so seconds with one decimal. */
export function shakeDurationText(ms) {
  return `${seconds.format(ms / 1000)} s`;
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });

/** Swift's `.formatted(date: .abbreviated, time: .standard)`. */
export function formatDateTime(timestamp) {
  return dateTime.format(new Date(timestamp));
}
