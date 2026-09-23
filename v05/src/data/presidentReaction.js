// Port of PresidentReaction.swift: a lightweight feedback reaction a user can attach to a
// president, picked from a small fixed set (mirrors iMessage-style tapbacks) rather than free
// text. `AppModel` persists these keyed by president order, same as the Swift version.
export const REACTIONS = [
  { id: 'heart', icon: 'heart-fill', label: 'Heart' },
  { id: 'thumbsUp', icon: 'hand-thumbs-up-fill', label: 'Thumbs up' },
  { id: 'thumbsDown', icon: 'hand-thumbs-down-fill', label: 'Thumbs down' },
  { id: 'question', icon: 'question-circle-fill', label: 'Question mark' },
];

const REACTIONS_BY_ID = Object.fromEntries(REACTIONS.map((r) => [r.id, r]));

export function reactionInfo(id) {
  return REACTIONS_BY_ID[id];
}
