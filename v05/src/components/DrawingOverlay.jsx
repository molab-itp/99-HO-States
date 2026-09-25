import { forwardRef } from 'react';

/**
 * SVG path for one stroke: quadratic curves through the midpoints between samples, which smooths
 * out the corners raw pointer samples would leave. A single-point stroke (a tap) becomes a
 * zero-length line, which the round line cap draws as a dot.
 */
export function strokePath(points) {
  if (points.length === 0) return '';
  const [x0, y0] = points[0];
  if (points.length === 1) return `M${x0} ${y0}L${x0} ${y0}`;
  let d = `M${x0} ${y0}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const [xn, yn] = points[points.length - 1];
  return `${d}L${xn} ${yn}`;
}

/**
 * A saved drawing (see `presidentDrawingStore.js`), drawn over the portrait it was made on. The
 * viewBox is the portrait's natural size, so filling the image's box with the same aspect ratio
 * lines every stroke up with the photo underneath, the way the Swift app's same-aspect PNG does.
 */
const DrawingOverlay = forwardRef(function DrawingOverlay(
  { drawing, className = 'drawing-overlay', children, ...svgProps },
  ref,
) {
  return (
    <svg ref={ref} className={className} viewBox={`0 0 ${drawing.width} ${drawing.height}`} {...svgProps}>
      {drawing.strokes.map((stroke, i) => (
        <path
          key={i}
          d={strokePath(stroke.points)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.size}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {children}
    </svg>
  );
});

export default DrawingOverlay;
