import { AppModelProvider } from './state/AppModelContext.jsx';
import { NavigationProvider, useNavigation } from './navigation/NavigationContext.jsx';
import { SlideshowProvider } from './state/SlideshowContext.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import PresidentListScreen from './screens/PresidentListScreen.jsx';
import PresidentDetailScreen from './screens/PresidentDetailScreen.jsx';

/** Renders whatever is topmost on the navigation stack, Home when the stack is empty. */
function Router() {
  const { path } = useNavigation();
  const top = path[path.length - 1];

  if (!top) return <HomeScreen />;
  if (top.type === 'list') return <PresidentListScreen key={top.navKey} />;
  return <PresidentDetailScreen key={top.navKey} selected={top.president} />;
}

export default function App() {
  return (
    <AppModelProvider>
      <NavigationProvider>
        <SlideshowProvider>
          <div className="app-shell">
            <Router />
          </div>
        </SlideshowProvider>
      </NavigationProvider>
    </AppModelProvider>
  );
}
