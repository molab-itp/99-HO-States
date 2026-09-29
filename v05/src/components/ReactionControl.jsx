import { useState } from 'react';
import ReactionPickerStrip from './ReactionPickerStrip.jsx';
import EmojiPickerSheet from './EmojiPickerSheet.jsx';
import Icon from './Icon.jsx';

/**
 * Port of PresidentDrawingEditorView.swift's `reactionControl`: a + button that pops up
 * `ReactionPickerStrip` (whose ★ opens `EmojiPickerSheet`), and a - button that always removes
 * whichever reaction was added most recently. The reactions themselves show on the photo (see
 * `ReactionOverlay`), not here. `onPickerToggle` reports whether the strip is open, so the editor
 * can make room for it.
 */
export default function ReactionControl({ reactions, onAdd, onRemoveLast, onPickerToggle }) {
  const [showingAddPicker, setShowingAddPicker] = useState(false);
  const [showingEmojiSheet, setShowingEmojiSheet] = useState(false);

  const setPickerShown = (shown) => {
    setShowingAddPicker(shown);
    onPickerToggle?.(shown);
  };

  const addReaction = (emoji) => {
    onAdd(emoji);
    setPickerShown(false);
  };

  return (
    <div className="reaction-control">
      <div className="reaction-row">
        <button
          type="button"
          className="reaction-btn"
          aria-label="Add Reaction"
          onClick={() => setPickerShown(!showingAddPicker)}
        >
          <Icon name="plus-circle" size={22} />
        </button>

        <button
          type="button"
          className="reaction-btn"
          aria-label="Remove Reaction"
          disabled={reactions.length === 0}
          onClick={onRemoveLast}
        >
          <Icon name="minus-circle" size={22} />
        </button>
      </div>

      {showingAddPicker && (
        <ReactionPickerStrip onPick={addReaction} onMore={() => setShowingEmojiSheet(true)} />
      )}

      {showingEmojiSheet && (
        <EmojiPickerSheet onPick={addReaction} onClose={() => setShowingEmojiSheet(false)} />
      )}
    </div>
  );
}
