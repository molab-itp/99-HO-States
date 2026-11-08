import NavBar from '../components/NavBar.jsx';
import HOSThumb from '../components/HOSThumb.jsx';
import Icon from '../components/Icon.jsx';
import greatestList from '../data/greatest.js';

/**
 * Port of GreatestView.swift — the 100 Greatest African Americans by Molefi Kete Asante, from
 * people.json, sorted by birth year. Pushed from Landing; tapping a row hands the person to
 * `onSelect` (which shows them on `GreatestDetailScreen`).
 */
export default function GreatestScreen({ onSelect, onBack }) {
  return (
    <div className="screen-scroll list-screen">
      <NavBar title="100 Greatest" onBack={onBack} />
      <div className="list-group">
        <ul className="hos-list greatest-list">
          {greatestList.map((person) => (
            <li key={person.id}>
              <button className="hos-row greatest-row" onClick={() => onSelect(person)}>
                <HOSThumb hos={person} />
                <span className="names">
                  <span className="label">
                    #{String(person.order).padStart(3, '0')} {person.name}
                  </span>
                  <span className="description">{person.description}</span>
                </span>
                <Icon name="chevron-right" size={14} className="chevron" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
