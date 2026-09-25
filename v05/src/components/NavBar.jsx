import { useNavigation } from '../navigation/NavigationContext.jsx';
import Icon from './Icon.jsx';

/**
 * Standing in for SwiftUI's automatic inline navigation bar (back button + centered title).
 * `onBack` replaces the default stack pop (for the drawing editor layer, which isn't a stack
 * entry), and `trailing` holds `.topBarTrailing` toolbar items.
 */
export default function NavBar({ title, monospace = false, onBack, trailing }) {
  const { path, pop } = useNavigation();
  const showBack = onBack || path.length > 0;

  return (
    <div className="nav-bar">
      <div className="nav-leading">
        {showBack && (
          <button className="nav-back" onClick={onBack ?? pop} aria-label="Back">
            <Icon name="chevron-left" size={20} />
          </button>
        )}
      </div>
      <span className={monospace ? 'nav-title nav-title-mono' : 'nav-title'}>{title}</span>
      <div className="nav-trailing">{trailing}</div>
    </div>
  );
}
