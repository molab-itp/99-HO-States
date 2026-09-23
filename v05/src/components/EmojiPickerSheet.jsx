import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Port of EmojiPickerSheet.swift: a searchable grid of emoji, shown from the ★ in
 * `ReactionPickerStrip`. The browser has no Unicode-name lookup, so the list and names come
 * from `unicode-emoji-json` (loaded lazily, so it stays out of the main bundle); search matches
 * against each emoji's name (e.g. "sun" finds ☀️ "sun"). Like the Swift version, skips skin-tone
 * variants. Portaled to `document.body` so the fixed-position sheet isn't clipped or offset by
 * the detail screen's scroll/transform containers.
 */
export default function EmojiPickerSheet({ onPick, onClose }) {
  const [entries, setEntries] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('unicode-emoji-json/data-by-emoji.json').then((mod) => {
      if (cancelled) return;
      const data = mod.default;
      setEntries(Object.keys(data).map((emoji) => ({ emoji, name: data[emoji].name.toLowerCase() })));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const query = searchText.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => entry.name.includes(query));
  }, [entries, searchText]);

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Choose Emoji"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <button type="button" className="sheet-cancel" onClick={onClose}>
            Cancel
          </button>
          <span className="sheet-title">Choose Emoji</span>
        </div>
        <input
          type="search"
          className="sheet-search"
          placeholder="Search"
          autoFocus
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div className="emoji-grid">
          {filtered.map((entry) => (
            <button
              key={entry.emoji}
              type="button"
              className="emoji-grid-cell"
              aria-label={entry.name}
              title={entry.name}
              onClick={() => {
                onPick(entry.emoji);
                onClose();
              }}
            >
              {entry.emoji}
            </button>
          ))}
          {entries && filtered.length === 0 && (
            <p className="emoji-grid-empty">No Results for “{searchText}”</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
