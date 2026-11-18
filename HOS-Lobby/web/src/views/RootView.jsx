import Spinner from '../components/Spinner.jsx';
import { useAuth } from '../services/AuthContext.jsx';
import HomeView from './HomeView.jsx';
import SignInView from './SignInView.jsx';

export default function RootView() {
  const { state } = useAuth();
  if (state.status === 'loading') {
    return (
      <div className="unavailable">
        <Spinner large />
      </div>
    );
  }
  if (state.status === 'signedOut') return <SignInView />;
  return <HomeView currentUserID={state.user.id} />;
}
