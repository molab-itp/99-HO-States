// Port of ZoomableHeaderImage.swift's `DrawingDisplayMode`: what the detail screen's header
// shows — the portrait, the portrait with its saved drawing laid over it, or the drawing alone.
// Chosen per president from the eye menu in `PresidentDetailScreen`'s nav bar and kept in
// `AppModel` (persisted by its raw string value, same as the Swift enum's Codable form).
export const DrawingDisplayMode = {
  photo: 'photo',
  photoAndDrawing: 'photoAndDrawing',
  drawingOnly: 'drawingOnly',
};

export const DEFAULT_DRAWING_DISPLAY_MODE = DrawingDisplayMode.photoAndDrawing;

/** Menu order, with each mode's title and icon (the Swift `title`/`systemImage`). */
export const DRAWING_DISPLAY_MODES = [
  { mode: DrawingDisplayMode.photo, title: 'Photo', icon: 'eye-slash' },
  { mode: DrawingDisplayMode.photoAndDrawing, title: 'Photo + Drawing', icon: 'eye' },
  { mode: DrawingDisplayMode.drawingOnly, title: 'Drawing Only', icon: 'scribble' },
];

export function drawingDisplayModeInfo(mode) {
  return DRAWING_DISPLAY_MODES.find((m) => m.mode === mode) ?? DRAWING_DISPLAY_MODES[1];
}

export function showsPhoto(mode) {
  return mode !== DrawingDisplayMode.drawingOnly;
}

export function showsDrawing(mode) {
  return mode !== DrawingDisplayMode.photo;
}

/** Keeps only entries with a known mode, so a stale or hand-edited save can't break rendering. */
export function normalizeDrawingDisplayModes(stored) {
  if (!stored || typeof stored !== 'object') return {};
  const known = new Set(Object.values(DrawingDisplayMode));
  return Object.fromEntries(Object.entries(stored).filter(([, mode]) => known.has(mode)));
}
