import { useLayoutEffect, useState } from 'react';
import { AppModelProvider, useAppModel } from './state/AppModelContext.jsx';
import { AppScreen } from './data/appScreen.js';
import LandingScreen from './screens/LandingScreen.jsx';
import HOSListScreen from './screens/HOSListScreen.jsx';
import HOSDetailScreen from './screens/HOSDetailScreen.jsx';
import NewsScreen from './screens/NewsScreen.jsx';

/**
 * Port of AppLandingView.swift: the navigation that `LandingScreen` sits at the bottom of. There
 * is no router — `appModel.screen` stands in for the `NavigationStack` path (which only ever
 * holds one pushed screen), and is persisted so the last screen shown is restored on reload.
 */
function Root() {
  const { hosList, slideIndex, screen, setScreen, select } = useAppModel();
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
    default:
      return (
        <LandingScreen
          onShowList={() => setScreen(AppScreen.hosList)}
          onShowDetail={showDetail}
          onShowNews={() => setScreen(AppScreen.news)}
        />
      );
  }
}

export default function App() {
  return (
    <AppModelProvider>
      <div className="app-shell">
        <Root />
      </div>
    </AppModelProvider>
  );
}
