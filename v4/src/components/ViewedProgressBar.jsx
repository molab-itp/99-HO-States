// Port of ViewedProgressBar in PresidentDetailView.swift: one segment per president, filled
// left-to-right as presidents are viewed, cycling red/green/yellow so progress reads as a strip
// of color rather than a single flat bar.
const COLORS = ['#d0342c', '#2e7d32', '#f2c811'];

export default function ViewedProgressBar({ total, viewedCount }) {
  const segments = Array.from({ length: Math.max(total, 1) }, (_, i) => i);
  return (
    <div
      className="progress-bar"
      role="img"
      aria-label="Presidents viewed"
      aria-valuetext={`${viewedCount} of ${total}`}
    >
      {segments.map((position) => {
        const isViewed = position < viewedCount;
        const color = COLORS[position % COLORS.length];
        return (
          <span
            key={position}
            className="progress-segment"
            style={{ background: isViewed ? color : undefined }}
          />
        );
      })}
    </div>
  );
}
