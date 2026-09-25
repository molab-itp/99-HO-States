// Port of PresidentDrawingStore.swift. The web has no PencilKit, so instead of a PNG plus
// `PKDrawing` data this keeps each president's drawing as one JSON value of vector strokes:
//
//   { width, height, strokes: [{ color, size, points: [[x, y], ...] }] }
//
// `width`/`height` are the portrait's natural pixel size, and every point and `size` is in those
// image pixels (not on-screen canvas pixels), the same idea as the Swift store's image-point
// coordinates: a drawing lines up with the photo at any screen size, and `DrawingOverlay` can
// render it straight into an SVG whose viewBox is the image's size. Strokes are far smaller than
// a PNG, which matters with localStorage's ~5MB per-origin quota.
//
// Each drawing gets its own key (rather than living in `persistedState.js`'s blob) so saving one
// doesn't rewrite the others, and so it can be written immediately — see `setDrawingFor`.
const KEY_PREFIX = 'ho-states-us.drawing.';

function storageKey(order) {
  return `${KEY_PREFIX}${order}`;
}

function isValidDrawing(value) {
  return (
    value &&
    value.width > 0 &&
    value.height > 0 &&
    Array.isArray(value.strokes) &&
    value.strokes.length > 0
  );
}

/** Every saved drawing, keyed by `president.order`. */
export function loadAllDrawings(presidents) {
  const drawings = {};
  for (const president of presidents) {
    try {
      const raw = window.localStorage.getItem(storageKey(president.order));
      if (!raw) continue;
      const drawing = JSON.parse(raw);
      if (isValidDrawing(drawing)) drawings[president.order] = drawing;
    } catch {
      // Unreadable storage or a corrupt entry — treat as no drawing.
    }
  }
  return drawings;
}

/** Returns false if the drawing couldn't be written (storage unavailable or full). */
export function saveDrawing(order, drawing) {
  try {
    window.localStorage.setItem(storageKey(order), JSON.stringify(drawing));
    return true;
  } catch {
    return false;
  }
}

export function deleteDrawing(order) {
  try {
    window.localStorage.removeItem(storageKey(order));
  } catch {
    // Storage unavailable — nothing was saved there to delete.
  }
}
