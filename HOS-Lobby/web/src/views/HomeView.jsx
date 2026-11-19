// Port of HomeView.swift: the signed-in landing page, a welcome and the app's sections.
import { useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import { useAuth } from '../services/AuthContext.jsx';
import { touchLastSeen } from '../services/profilesService.js';
import AppVersionLabel from './AppVersionLabel.jsx';
import ShakesView from './ShakesView.jsx';
import UsersListView from './UsersListView.jsx';
import { useRoute } from './useRoute.js';

const SOURCE_REPO_URL = 'https://github.com/molab-itp/99-HO-States/tree/main/HOS-Lobby';

export default function HomeView({ currentUserID }) {
  const { client, signOut } = useAuth();
  const { route, push } = useRoute();

  // App opens count as activity in the Users list even if it's never opened.
  useEffect(() => {
    const touch = () => touchLastSeen(client).catch(() => {});
    touch();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') touch();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [client]);

  if (route.name === 'users' || route.name === 'user') return <UsersListView currentUserID={currentUserID} />;
  if (route.name === 'shakes' || route.name === 'shakeHistory' || route.name === 'shakeSession') return <ShakesView currentUserID={currentUserID} />;

  return (
    <div className="app-shell">
      <NavBar
        title="HOS-Lobby"
        trailing={
          <button className="nav-button" onClick={signOut}>
            Sign Out
          </button>
        }
      />
      <div className="list-screen">
        <div className="home-hero">
          <Icon className="home-hero-icon" name="door-open-fill" size={48} />
          <h1>Welcome to HOS-Lobby</h1>
          <AppVersionLabel small />
        </div>
        <ul className="list">
          <HomeLink
            icon="people-fill"
            title="Users"
            subtitle="Everyone who has signed on, most recently active first"
            onClick={() => push('/users')}
          />
          <HomeLink
            icon="phone-vibrate"
            title="Shakes"
            subtitle="Shake your phone and see who has shaken the most"
            onClick={() => push('/shakes')}
          />
        </ul>
        <ul className="list">
          <li className="list-item">
            <a className="home-source" href={SOURCE_REPO_URL} target="_blank" rel="noreferrer">
              <Icon name="code-slash" size={20} />
              Source on GitHub
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

function HomeLink({ icon, title, subtitle, onClick }) {
  return (
    <li className="list-item home-link">
      <button className="list-row" onClick={onClick}>
        <Icon className="home-link-icon" name={icon} size={24} />
        <span className="home-link-text">
          <span className="home-link-title">{title}</span>
          <span className="home-link-subtitle">{subtitle}</span>
        </span>
        <Icon className="list-chevron" name="chevron-right" size={14} />
      </button>
    </li>
  );
}
