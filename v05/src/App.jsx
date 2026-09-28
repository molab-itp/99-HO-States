import { AppModelProvider, useAppModel } from './state/AppModelContext.jsx';
import PresidentDetailScreen from './screens/PresidentDetailScreen.jsx';

/**
 * Port of `HO_States_US_App`'s root: the app opens straight onto the detail screen at the
 * persisted `slideIndex` (Settings is a sheet presented from there).
 */
function Root() {
  const { presidents, slideIndex } = useAppModel();
  return <PresidentDetailScreen selected={presidents[slideIndex] ?? presidents[0]} />;
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
