import { useAppModel } from '../state/AppModelContext.jsx';
import NavBar from '../components/NavBar.jsx';
import HOSThumb from '../components/HOSThumb.jsx';
import Icon from '../components/Icon.jsx';

/**
 * Port of HOSListView.swift. Pushed from Landing; tapping a row hands the HOS to
 * `onSelect` (which shows it on the detail screen).
 */
export default function HOSListScreen({ onSelect, onBack }) {
  const { hosList, reactionsFor } = useAppModel();

  return (
    <div className="screen-scroll list-screen">
      <NavBar title="USnA Heads" onBack={onBack} />
      <div className="list-group">
        <ul className="hos-list">
          {hosList.map((hos) => (
            <li key={hos.order}>
              <button className="hos-row" onClick={() => onSelect(hos)}>
                <HOSThumb hos={hos} />
                <span className="names">
                  <span className="name">
                    #{String(hos.order).padStart(2, '0')} {hos.name}
                  </span>
                  <span className="term-row">
                    <span className="term">{hos.term}</span>
                    <span className="reactions">{reactionsFor(hos).join('')}</span>
                  </span>
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
