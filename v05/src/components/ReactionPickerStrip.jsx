import { REACTIONS } from '../data/presidentReaction.js';
import Icon from './Icon.jsx';

/**
 * Port of ReactionPickerStrip.swift: the horizontal strip of reaction choices that pops up from
 * the + button below a president's name. Always shows all four reactions — repeats are allowed,
 * so there's nothing to filter out based on what's already picked.
 */
export default function ReactionPickerStrip({ onPick }) {
  return (
    <div className="reaction-picker-strip">
      {REACTIONS.map((reaction) => (
        <button
          key={reaction.id}
          type="button"
          className="reaction-picker-option"
          aria-label={reaction.label}
          onClick={() => onPick(reaction.id)}
        >
          <Icon name={reaction.icon} size={16} />
        </button>
      ))}
    </div>
  );
}
