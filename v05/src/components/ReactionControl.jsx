import { useState } from 'react';
import { reactionInfo } from '../data/presidentReaction.js';
import ReactionPickerStrip from './ReactionPickerStrip.jsx';
import Icon from './Icon.jsx';

/**
 * Port of PresidentSummaryView.swift's `reactionControl`: the current reactions for a president
 * (in add-order, repeats allowed), a + button that pops up `ReactionPickerStrip`, and a - button
 * that always removes whichever reaction was added most recently.
 */
export default function ReactionControl({ reactions, onAdd, onRemoveLast }) {
  const [showingAddPicker, setShowingAddPicker] = useState(false);

  return (
    <div className="reaction-control">
      <div className="reaction-row">
        {reactions.map((id, i) => {
          const info = reactionInfo(id);
          if (!info) return null;
          return (
            <span key={i} className="reaction-icon" aria-label={info.label}>
              <Icon name={info.icon} size={17} />
            </span>
          );
        })}

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
        <ReactionPickerStrip
          onPick={(id) => {
            onAdd(id);
            setShowingAddPicker(false);
          }}
        />
      )}
    </div>
  );
}
