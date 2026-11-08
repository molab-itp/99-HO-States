/**
 * Port of ReactionOverlay.swift: an HOS's reactions as a layer over the portrait — one row of
 * emoji along the image's bottom edge, in the order added. The row shrinks to fit rather than
 * wrapping or clipping once there are more reactions than fit across. Ignores the pointer, so
 * gestures and pen strokes go through to the photo or drawing surface beneath.
 */
export default function ReactionOverlay({ reactions }) {
  if (!reactions || reactions.length === 0) return null;
  // Each emoji plus its separating space is about 1.3em wide, so this caps the font size at what
  // fits `reactions.length` of them across the overlay's width (`cqw`, the overlay being the
  // size container), same effect as Swift's `.minimumScaleFactor`.
  const fontSize = `min(34px, calc((100cqw - 16px) / ${reactions.length * 1.3}))`;
  return (
    <div className="reaction-overlay" aria-label={reactions.join(' ')}>
      <span style={{ fontSize }}>{reactions.join(' ')}</span>
    </div>
  );
}
