/**
 * Stands in for a SwiftUI `Picker` with `.pickerStyle(.segmented)` inside a `LabeledContent`:
 * a label on the left and a row of mutually exclusive segments on the right. With `hidesLabel`
 * it is the bare Picker: just the segments, named by `label` for assistive technology.
 */
export default function SegmentedPicker({ label, options, value, onChange, formatOption, hidesLabel = false }) {
  const segments = (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={option === value ? 'segment selected' : 'segment'}
          onClick={() => onChange(option)}
        >
          {formatOption(option)}
        </button>
      ))}
    </div>
  );
  if (hidesLabel) return segments;
  return (
    <div className="labeled-row">
      <span>{label}</span>
      {segments}
    </div>
  );
}
