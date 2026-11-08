// Port of v2's Account/AuthModel.swift and AccountSession.swift, copied from
// v07/src/services/AuthContext.jsx; keep v07 as the source of truth. Owns the Supabase client and
// mirrors its auth session into React state. `useAuth()` is the `@Environment(AuthModel.self)`
// stand-in, and is `null` when `.env.local` isn't set up, which hides the Account feature.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authRedirectURL } from './supabaseConfig.js';
import { markSignedOut, touchLastSeen } from './profilesService.js';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/** The error a failed magic link or Apple sign-in leaves in the address it comes back to. */
function callbackError() {
  for (const part of [window.location.search, window.location.hash]) {
    const message = new URLSearchParams(part.slice(1)).get('error_description');
    if (message) return message;
  }
  return null;
}

/** Whether the page is showing, the web's `scenePhase == .active`. */
function useIsPageVisible() {
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const update = () => setIsVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return isVisible;
}

export function AuthProvider({ client, children }) {
  /** `status` is 'loading', 'signedOut' or 'signedIn' (with `user`). */
  const [state, setState] = useState({ status: 'loading', user: null });
  const [errorMessage, setErrorMessage] = useState(callbackError);

  // Runs for the app's lifetime. The first event is the locally stored session, if any; the
  // client refreshes an expired token on its own and emits a signed-out event if that fails.
  // Coming back from a magic link or from Apple also ends up here: the client finishes the
  // sign-in from the address on its own.
  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'signedIn', user: session.user } : { status: 'signedOut', user: null });
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  // AccountSession's `touchLastSeen`: on each sign-in and each return to the page.
  const isPageVisible = useIsPageVisible();
  const activeUserID = isPageVisible && state.status === 'signedIn' ? state.user.id : null;
  useEffect(() => {
    if (activeUserID) touchLastSeen(client).catch(() => {});
  }, [client, activeUserID]);

  const actions = useMemo(() => {
    /** Runs an auth call, returning whether it worked and showing its error if not. */
    async function attempt(call) {
      setErrorMessage(null);
      try {
        const { error } = await call();
        if (error) throw error;
        return true;
      } catch (error) {
        setErrorMessage(error.message);
        return false;
      }
    }

    return {
      /**
       * Emails a 6-digit code, creating the user on first use. The email templates carry no
       * link (mail scanners would use up the shared token); if one is added back, it reopens
       * this page at `authRedirectURL()`. Returns whether the email was sent, so the UI can
       * switch to "enter the code".
       */
      sendSignInEmail: (email) =>
        attempt(() => client.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectURL() } })),

      /** Verifies the 6-digit code from the email, which fires the auth state change. */
      verifyCode: (code, email) => attempt(() => client.auth.verifyOtp({ email, token: code, type: 'email' })),

      /**
       * Sign in with Apple, the web way: leaves for Apple's page, which returns here signed in.
       * Needs this app's address in the dashboard's Redirect URLs, as well as v07's.
       */
      signInWithApple: () =>
        attempt(() => client.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: authRedirectURL() } })),

      /**
       * "Continue as Guest": a real user with its own id (so `app_state` and RLS work as usual),
       * but no email. Needs "Allow anonymous sign-ins" enabled in the Supabase dashboard.
       */
      signInAsGuest: () => attempt(() => client.auth.signInAnonymously()),

      /**
       * Tells other clients first (see `markSignedOut`), since nothing in `profiles` changes on
       * sign-out itself. That's best effort: it never blocks signing out.
       */
      async signOut() {
        await markSignedOut(client).catch(() => {});
        const { error } = await client.auth.signOut();
        if (error) setErrorMessage(error.message);
      },
    };
  }, [client]);

  const value = useMemo(
    () => ({ client, state, errorMessage, setErrorMessage, ...actions }),
    [client, state, errorMessage, actions],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
