import { useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import { useNavigation } from '../navigation/NavigationContext.jsx';
import Icon from '../components/Icon.jsx';

const WIKIPEDIA_SOURCE_URL = 'https://en.wikipedia.org/wiki/List_of_presidents_of_the_United_States';

export default function HomeScreen() {
  const { presidents, viewedIDs, nextRandomPresident, resetViewed, slideIndex } = useAppModel();
  const { pushList, replaceWithDetail } = useNavigation();
  const [isRandomMode, setIsRandomMode] = useState(false);

  const remainingCount = presidents.length - viewedIDs.size;

  // Random mode draws the next card from the shared shuffle (resuming wherever it left off);
  // sequential mode resumes from wherever `slideIndex` was last left, falling back to the first
  // president only if that index is somehow out of bounds. Home is unreachable again until the
  // slideshow is left (its detail screen covers it, same as the SwiftUI app), so there's no "Stop
  // Slideshow" state to show here.
  function startSlideshow() {
    const president = isRandomMode ? nextRandomPresident() : presidents[slideIndex] ?? presidents[0];
    if (!president) return;
    replaceWithDetail(president, { startSlideshow: true, isRandomMode });
  }

  return (
    <div className="home">
      <div className="icon">
        <Icon name="bank" size={64} />
      </div>
      <h1>USNA Heads</h1>
      <p className="subtitle">Browse portraits and biographies of every United States of North America Head of State.</p>

      <div className="actions">
        <button className="btn btn-bordered" onClick={pushList}>
          <Icon name="list-ul" />
          List of Heads
        </button>
        <button className="btn btn-bordered" onClick={() => replaceWithDetail(nextRandomPresident())}>
          <Icon name="shuffle" />
          Random Head
        </button>
        <label className="toggle-row">
          <span>Random Mode</span>
          <span className="switch">
            <input
              type="checkbox"
              checked={isRandomMode}
              onChange={(e) => setIsRandomMode(e.target.checked)}
            />
            <span className="switch-track" />
            <span className="switch-thumb" />
          </span>
        </label>
        <button className="btn btn-bordered" onClick={startSlideshow}>
          <Icon name="play-circle-fill" />
          Start Slideshow
        </button>
      </div>

      <a className="source-link" href={WIKIPEDIA_SOURCE_URL} target="_blank" rel="noopener noreferrer">
        <Icon name="link-45deg" size={14} />
        Source: Wikipedia
      </a>

      <div className="visited">
        <p className="visited-count">{remainingCount} left to see</p>
        <button className="btn-text-destructive" onClick={resetViewed}>
          Reset Visit Count
        </button>
      </div>
    </div>
  );
}
