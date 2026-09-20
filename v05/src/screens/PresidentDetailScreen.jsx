import { useEffect, useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import { useSlideshow } from '../state/SlideshowContext.jsx';
import { wikipediaArticleURL } from '../data/wikipedia.js';
import { assetUrl } from '../data/assetUrl.js';
import NavBar from '../components/NavBar.jsx';
import ViewedProgressBar from '../components/ViewedProgressBar.jsx';
import Icon from '../components/Icon.jsx';

const DETAIL_REVEAL_DELAY_MS = 2000; // matches Swift's `delaySecs`

/** Port of PresidentDetailView.swift. `selected` is the president this screen was pushed with. */
export default function PresidentDetailScreen({ selected }) {
  const { presidents, viewedIDs, buildInfo, markViewed, nextRandomPresident } = useAppModel();
  const slideshow = useSlideshow();
  const isSlideshowActive = slideshow.isRunning;

  const [index, setIndex] = useState(() => {
    const found = presidents.findIndex((p) => p.order === selected.order);
    return found >= 0 ? found : 0;
  });
  const [detailsVisible, setDetailsVisible] = useState(false);

  const president = presidents[index];
  const isFirst = index === 0;
  const isLast = index === presidents.length - 1;

  // Mirrors `.task(id: index)`: mark viewed immediately, then fade the text in after a delay
  // that's cancelled (never revealed) if `index` changes again first.
  useEffect(() => {
    let cancelled = false;
    markViewed(president, isSlideshowActive);
    setDetailsVisible(false);
    const timer = setTimeout(() => {
      if (!cancelled) setDetailsVisible(true);
    }, DETAIL_REVEAL_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function handleToolbarButton(action) {
    if (isSlideshowActive) {
      slideshow.stop();
      return;
    }
    action();
  }

  function goToPrevious() {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }

  function goToNext() {
    setIndex((i) => (i < presidents.length - 1 ? i + 1 : i));
  }

  function goToRandom() {
    const next = nextRandomPresident();
    if (!next) return;
    const newIndex = presidents.findIndex((p) => p.order === next.order);
    if (newIndex >= 0) setIndex(newIndex);
  }

  const orderText = String(president.order).padStart(2, '0');
  const title = isSlideshowActive
    ? `#${orderText} · ${(slideshow.remainingTenths / 10).toFixed(1).padStart(4, '0')}s ${buildInfo}`
    : `#${orderText} ${buildInfo}`;

  const imageSrc = president.large || president.thumbnail;
  const articleURL = wikipediaArticleURL(president);

  return (
    <div className="screen-scroll">
      <NavBar title={title} monospace />
      <div className="detail">
        <ViewedProgressBar total={presidents.length} viewedCount={viewedIDs.size} />

        {imageSrc ? (
          <img className="detail-image" src={assetUrl(imageSrc)} alt={president.name} />
        ) : (
          <div className="detail-image-placeholder">
            <Icon name="person-circle" size={64} />
          </div>
        )}

        <div className={detailsVisible ? 'detail-text visible' : 'detail-text'}>
          <h1 className="name-mono">
            #{president.order} {president.name}
          </h1>
          <p className="subtitle">
            {president.term} · {president.party}
          </p>
          <p>{president.extract}</p>
          {articleURL && (
            <a className="wiki-link" href={articleURL} target="_blank" rel="noopener noreferrer">
              <Icon name="book" size={14} />
              Read on Wikipedia
            </a>
          )}
        </div>
      </div>

      <div className="detail-toolbar">
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label="Previous"
          disabled={!isSlideshowActive && isFirst}
          onClick={() => handleToolbarButton(goToPrevious)}
        >
          <Icon name="chevron-left" size={20} />
        </button>
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label="Random"
          onClick={() => handleToolbarButton(goToRandom)}
        >
          <Icon name="shuffle" size={19} />
        </button>
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label="Next"
          disabled={!isSlideshowActive && isLast}
          onClick={() => handleToolbarButton(goToNext)}
        >
          <Icon name="chevron-right" size={20} />
        </button>
      </div>
    </div>
  );
}
