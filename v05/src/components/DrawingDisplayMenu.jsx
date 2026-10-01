import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { DRAWING_DISPLAY_MODES, drawingDisplayModeInfo } from '../data/drawingDisplayMode.js';

/**
 * Port of PresidentDetailView.swift's eye toolbar item: a SwiftUI `Menu` wrapping a `Picker`.
 * The bar button shows the current mode's icon; tapping it drops down the three modes with a
 * checkmark on the current one. Picking a mode, tapping outside, or Escape closes it.
 */
export default function DrawingDisplayMenu({ mode, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const current = drawingDisplayModeInfo(mode);
  const rootRef = useRef(null);

  // A document listener rather than a full-screen backdrop element: the nav bar's
  // backdrop-filter makes it the containing block for `position: fixed` children, so a backdrop
  // inside it couldn't cover the page.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setIsOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  return (
    <div className="nav-menu" ref={rootRef}>
      <button
        className="nav-action"
        aria-label={current.title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon name={current.icon} size={19} />
      </button>
      {isOpen && (
        <div className="nav-menu-list" role="menu" aria-label="Show">
          {DRAWING_DISPLAY_MODES.map((m) => (
            <button
              key={m.mode}
              className="nav-menu-item"
              role="menuitemradio"
              aria-checked={m.mode === mode}
              onClick={() => {
                setIsOpen(false);
                onChange(m.mode);
              }}
            >
              <span className="nav-menu-check">{m.mode === mode && <Icon name="check" size={16} />}</span>
              <span className="nav-menu-title">{m.title}</span>
              <Icon name={m.icon} size={17} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
