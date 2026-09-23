import { useState } from 'react';
import ReactionPickerStrip from './ReactionPickerStrip.jsx';
import EmojiPickerSheet from './EmojiPickerSheet.jsx';
import Icon from './Icon.jsx';

/**
 * Port of PresidentSummaryView.swift's `reactionControl`: the current reactions for a president
 * (emoji, in add-order, repeats allowed), a + button that pops up `ReactionPickerStrip` (whose
 * ★ opens `EmojiPickerSheet`), and a - button that always removes whichever reaction was added
 * most recently.
 */
export default function ReactionControl({ reactions, onAdd, onRemoveLast }) {
  const [showingAddPicker, setShowingAddPicker] = useState(false);
  const [showingEmojiSheet, setShowingEmojiSheet] = useState(false);

  const addReaction = (emoji) => {
    onAdd(emoji);
    setShowingAddPicker(false);
  };

  return (
    <div className="reaction-control">
      <div className="reaction-row">
        {reactions.map((emoji, i) => (
          <span key={i} className="reaction-icon">
            {emoji}
          </span>
        ))}

        <button
          type="button"
          className="reaction-btn"
          aria-label="Add Reaction"
          onClick={() => setShowingAddPicker((v) => !v)}
        >
          <Icon name="plus-circle" size={17} />
        </button>

        <button
          type="button"
          className="reaction-btn"
          aria-label="Remove Reaction"
          disabled={reactions.length === 0}
          onClick={onRemoveLast}
        >
          <Icon name="minus-circle" size={17} />
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
