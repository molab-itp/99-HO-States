import { useLayoutEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthProvider } from './account/AuthContext.jsx';
import { loadSupabaseConfig } from './account/supabaseConfig.js';
import { AppModelProvider, useAppModel } from './state/AppModelContext.jsx';
import { AppScreen } from './data/appScreen.js';
import LandingScreen from './screens/LandingScreen.jsx';
import HOSListScreen from './screens/HOSListScreen.jsx';
import HOSDetailScreen from './screens/HOSDetailScreen.jsx';
import NewsScreen from './screens/NewsScreen.jsx';
import GreatestScreen from './screens/GreatestScreen.jsx';
import GreatestDetailScreen from './screens/GreatestDetailScreen.jsx';
import greatestList from './data/greatest.js';
import CreditsScreen from './screens/CreditsScreen.jsx';
import SpeechSetupScreen from './screens/SpeechSetupScreen.jsx';
import AccountScreen from './account/AccountScreen.jsx';

// Port of v2's `AccountSession.makeAuthModel()`: `null` until `.env.local` (or the Pages
// workflow's repository variables) holds the Supabase project, which hides the Account feature
// rather than showing v07's `SetupRequiredView`, since sign-in is optional here.
const { config: supabaseConfig, error: supabaseError } = loadSupabaseConfig();
if (supabaseError) console.info(`Account disabled: ${supabaseError}`);
const supabaseClient = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      // PKCE, as in v07: a sign-in link or Apple's redirect comes back with a one-time `?code=`,
      // which only the browser that asked for it can exchange.
      auth: { flowType: 'pkce' },
    })
  : null;

/**
 * Port of AppLandingView.swift: the navigation that `LandingScreen` sits at the bottom of. There
 * is no router — `appModel.screen` stands in for the `NavigationStack` path (which holds one
 * pushed screen, or two for a Greatest figure over the Greatest list), and is persisted so the last screen shown is restored on reload.
 */
function Root() {
  const { hosList, slideIndex, screen, setScreen, select, setGreatestIndex } = useAppModel();
  // Whether the next `HOSDetailScreen` shown should open with its slideshow playing (Landing's
  // Start Slideshow) rather than paused.
  const [startsSlideshowOnOpen, setStartsSlideshowOnOpen] = useState(false);

  // Each screen starts at its top, like a freshly pushed SwiftUI view, instead of inheriting the
  // page scroll of the screen it replaced.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Shows `HOSDetailScreen` at `slideIndex`, replacing the list if it was up, so Back returns
  // to `LandingScreen`.
  function showDetail(startSlideshow) {
    setStartsSlideshowOnOpen(startSlideshow);
    setScreen(AppScreen.hosDetail);
  }

  function showLanding() {
    setScreen(AppScreen.landing);
  }

  switch (screen) {
    case AppScreen.hosList:
      return (
        <HOSListScreen
          onSelect={(hos) => {
            select(hos);
            showDetail(false);
          }}
          onBack={showLanding}
        />
      );
    case AppScreen.hosDetail:
      return (
        <HOSDetailScreen
          selected={hosList[slideIndex] ?? hosList[0]}
          startsPlaying={startsSlideshowOnOpen}
          onBack={showLanding}
        />
      );
    case AppScreen.news:
      return <NewsScreen onBack={showLanding} />;
    case AppScreen.greatest:
      return (
        <GreatestScreen
          onSelect={(person) => {
            setGreatestIndex(greatestList.indexOf(person));
            setScreen(AppScreen.greatestDetail);
          }}
          onBack={showLanding}
        />
      );
    case AppScreen.greatestDetail:
      // Pushed over the Greatest list, so Back returns there rather than to Landing.
      return <GreatestDetailScreen onBack={() => setScreen(AppScreen.greatest)} />;
    case AppScreen.credits:
      return <CreditsScreen onBack={showLanding} />;
    case AppScreen.speechSetup:
      return <SpeechSetupScreen onBack={showLanding} />;
    case AppScreen.account:
      // Restored on reload even if Account has since been turned off; `AccountScreen` then says so.
      return <AccountScreen onBack={showLanding} />;
    default:
      return (
        <LandingScreen
          onShowList={() => setScreen(AppScreen.hosList)}
          onShowDetail={showDetail}
          onShowNews={() => setScreen(AppScreen.news)}
          onShowGreatest={() => setScreen(AppScreen.greatest)}
          onShowCredits={() => setScreen(AppScreen.credits)}
          onShowSpeechSetup={() => setScreen(AppScreen.speechSetup)}
          onShowAccount={() => setScreen(AppScreen.account)}
        />
      );
  }
}

export default function App() {
  const app = (
    <AppModelProvider>
      <div className="app-shell">
        <Root />
      </div>
    </AppModelProvider>
  );
  return supabaseClient ? <AuthProvider client={supabaseClient}>{app}</AuthProvider> : app;
}
