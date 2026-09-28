import Icon from './Icon.jsx';

/**
 * Standing in for SwiftUI's automatic inline navigation bar (back button + centered title).
 * `onBack` shows a leading back chevron, and `trailing` holds `.topBarTrailing` toolbar items.
 */
export default function NavBar({ title, monospace = false, onBack, trailing }) {
  return (
    <div className="nav-bar">
      <div className="nav-leading">
        {onBack && (
          <button className="nav-back" onClick={onBack} aria-label="Back">
            <Icon name="chevron-left" size={20} />
          </button>
        )}
      </div>
      <span className={monospace ? 'nav-title nav-title-mono' : 'nav-title'}>{title}</span>
      <div className="nav-trailing">{trailing}</div>
    </div>
  );
}
