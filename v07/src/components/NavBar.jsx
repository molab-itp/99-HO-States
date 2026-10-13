import Icon from './Icon.jsx';

/**
 * Standing in for SwiftUI's inline navigation bar (back button + centered title). `onBack` shows
 * a leading back chevron, `leading` holds other leading items, and `trailing` holds
 * `.topBarTrailing` toolbar items.
 */
export default function NavBar({ title, onBack, leading, trailing }) {
  return (
    <div className="nav-bar">
      <div className="nav-leading">
        {onBack && (
          <button className="nav-button nav-back" onClick={onBack} aria-label="Back">
            <Icon name="chevron-left" size={20} />
          </button>
        )}
        {leading}
      </div>
      <span className="nav-title">{title}</span>
      <div className="nav-trailing">{trailing}</div>
    </div>
  );
}
