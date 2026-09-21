import { useAppModel } from '../state/AppModelContext.jsx';
import { useNavigation } from '../navigation/NavigationContext.jsx';
import NavBar from '../components/NavBar.jsx';
import PresidentThumb from '../components/PresidentThumb.jsx';
import Icon from '../components/Icon.jsx';

/** Port of PresidenttListView.swift. */
export default function PresidentListScreen() {
  const { presidents } = useAppModel();
  const { pushDetail } = useNavigation();

  return (
    <div className="screen-scroll list-screen">
      <NavBar title="USNA Heads" />
      <div className="list-group">
        <ul className="president-list">
          {presidents.map((president) => (
            <li key={president.order}>
              <button className="president-row" onClick={() => pushDetail(president)}>
                <PresidentThumb president={president} />
                <span className="names">
                  <span className="name">
                    #{String(president.order).padStart(2, '0')} {president.name}
                  </span>
                  <span className="term">{president.term}</span>
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
