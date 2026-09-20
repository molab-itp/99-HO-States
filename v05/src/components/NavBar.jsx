import { useNavigation } from '../navigation/NavigationContext.jsx';
import Icon from './Icon.jsx';

/** Standing in for SwiftUI's automatic inline navigation bar (back button + centered title). */
export default function NavBar({ title, monospace = false }) {
  const { path, pop } = useNavigation();
  const showBack = path.length > 0;

  return (
    <div className="nav-bar">
      {showBack ? (
        <button className="nav-back" onClick={pop} aria-label="Back">
          <Icon name="chevron-left" size={15} />
          Back
        </button>
      ) : (
        <span className="nav-spacer" />
      )}
      <span className={monospace ? 'nav-title nav-title-mono' : 'nav-title'}>{title}</span>
      <span className="nav-spacer" />
    </div>
  );
}
