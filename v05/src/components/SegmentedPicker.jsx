/**
 * Stands in for a SwiftUI `Picker` with `.pickerStyle(.segmented)` inside a `LabeledContent`:
 * a label on the left and a row of mutually exclusive segments on the right.
 */
export default function SegmentedPicker({ label, options, value, onChange, formatOption }) {
  return (
    <div className="labeled-row">
      <span>{label}</span>
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
    </div>
  );
}
