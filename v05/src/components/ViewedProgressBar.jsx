// Port of ViewedProgressBar in PresidentDetailView.swift: one segment per president, at its own
// position (by order), filled in once that president has been viewed, cycling red/green/yellow
// so progress reads as a strip of color rather than a single flat bar.
const COLORS = ['#d0342c', '#2e7d32', '#f2c811'];

export default function ViewedProgressBar({ total, viewedIDs }) {
  const segments = Array.from({ length: Math.max(total, 1) }, (_, i) => i);
  return (
    <div
      className="progress-bar"
      role="img"
      aria-label="Heads viewed"
      aria-valuetext={`${viewedIDs.size} of ${total}`}
    >
      {segments.map((position) => {
        const isViewed = viewedIDs.has(position + 1);
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
