// Port of PresidentReaction.swift: a lightweight feedback reaction a user can attach to a
// president — a single emoji, either one of the quick-pick `PRESETS` or any emoji chosen from
// `EmojiPickerSheet`. `AppModel` persists these (as bare emoji strings) keyed by president order,
// same as the Swift version.

// The quick-pick choices shown in `ReactionPickerStrip`, ahead of its ★ "more" button.
export const PRESETS = ['🫏', '🐘', '☀️', '🌍', '🌗'];

// Values written by the earlier fixed-set, icon-based version, mapped to equivalent emoji so
// reactions saved before the switch still show up as something sensible.
const LEGACY_VALUES = {
  heart: '❤️',
  thumbsUp: '👍',
  thumbsDown: '👎',
  question: '❓',
};

export function normalizeReaction(value) {
  return LEGACY_VALUES[value] ?? value;
}

// Applies `normalizeReaction` across a persisted `{ [order]: [reaction, ...] }` map.
export function normalizeReactions(reactions) {
  return Object.fromEntries(
    Object.entries(reactions ?? {}).map(([order, list]) => [order, list.map(normalizeReaction)])
  );
}
