import NavBar from '../components/NavBar.jsx';
import NewsThumb from '../components/NewsThumb.jsx';
import news from '../data/news.js';

/**
 * Port of NewsView.swift — the list of news links from news.json. Pushed from Landing; tapping a
 * row opens its URL in a new tab.
 */
export default function NewsScreen({ onBack }) {
  return (
    <div className="screen-scroll list-screen">
      <NavBar title="News" onBack={onBack} />
      <div className="list-group">
        <ul className="hos-list news-list">
          {news.map((item) => (
            <li key={item.url}>
              <a className="hos-row news-row" href={item.url} target="_blank" rel="noopener noreferrer">
                <NewsThumb item={item} />
                <span className="names">
                  <span className="label">{item.label}</span>
                  <span className="host">{new URL(item.url).host}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
