// Port of SupabaseConfig.swift. The project URL + publishable key come from Vite's env
// (`.env.local`, gitignored, or the Pages workflow's repository variables) and are baked into the
// build, where v06 reads them from the bundled `Supabase.plist`.

/**
 * Where the magic-link email and Sign in with Apple send the user back to: this app's own
 * address. It must also be listed under the Supabase dashboard's Auth > URL Configuration >
 * Redirect URLs (and in `supabase/config.toml` for the local stack).
 */
export function authRedirectURL() {
  return window.location.origin + import.meta.env.BASE_URL;
}

function isURL(string) {
  try {
    return Boolean(new URL(string).host);
  } catch {
    return false;
  }
}

const SETUP = 'Copy .env.example to .env.local, fill it in, then restart the dev server.';

/**
 * `{ config: { url, publishableKey } }`, or `{ error }` with what's wrong when the values are
 * missing or still hold `.env.example`'s placeholders.
 */
export function loadSupabaseConfig(env = import.meta.env) {
  const urlString = (env.VITE_SUPABASE_URL ?? '').trim();
  if (!isURL(urlString)) {
    return { error: `VITE_SUPABASE_URL isn't set to a valid URL. ${SETUP}` };
  }
  if (urlString.includes('YOUR-PROJECT-REF')) {
    return { error: "VITE_SUPABASE_URL is still the example value. Use your project's URL." };
  }
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (!key) {
    return { error: `VITE_SUPABASE_PUBLISHABLE_KEY isn't set. ${SETUP}` };
  }
  if (key.endsWith('...')) {
    return {
      error:
        'VITE_SUPABASE_PUBLISHABLE_KEY is still the example value. Paste the publishable key from Dashboard > Project Settings > API Keys.',
    };
  }
  return { config: { url: urlString, publishableKey: key } };
}
