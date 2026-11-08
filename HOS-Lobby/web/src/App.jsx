// Port of HOS_LobbyApp.swift.
import { createClient } from '@supabase/supabase-js';
import { AuthProvider } from './services/AuthContext.jsx';
import { loadSupabaseConfig } from './supabaseConfig.js';
import RootView from './views/RootView.jsx';
import SetupRequiredView from './views/SetupRequiredView.jsx';

// An error until `.env.local` is filled in; the app then shows what's wrong instead of failing,
// so a fresh clone still builds and runs.
const { config, error } = loadSupabaseConfig();
const client = config
  ? createClient(config.url, config.publishableKey, {
      // PKCE, as in v06: a sign-in link or Apple's redirect comes back with a one-time `?code=`,
      // which only the browser that asked for it can exchange.
      auth: { flowType: 'pkce' },
    })
  : null;

export default function App() {
  if (!client) return <SetupRequiredView message={error} />;
  return (
    <AuthProvider client={client}>
      <RootView />
    </AuthProvider>
  );
}
