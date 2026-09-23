import { PRESETS } from '../data/presidentReaction.js';

/**
 * Port of ReactionPickerStrip.swift: the horizontal strip of reaction choices that pops up from
 * the + button below a president's name — the quick-pick emoji in `PRESETS`, then a trailing ★
 * that asks for the full emoji sheet (`onMore`) instead of picking anything itself. Always shows
 * all presets — repeats are allowed, so there's nothing to filter out.
 */
export default function ReactionPickerStrip({ onPick, onMore }) {
  return (
    <div className="reaction-picker-strip">
      {PRESETS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-picker-option"
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        className="reaction-picker-option reaction-picker-more"
        aria-label="More Emoji"
        onClick={onMore}
      >
        ★
      </button>
    </div>
  );
}
