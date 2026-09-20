import { useAppModel } from '../state/AppModelContext.jsx';
import { useNavigation } from '../navigation/NavigationContext.jsx';
import { useSlideshow } from '../state/SlideshowContext.jsx';
import Icon from '../components/Icon.jsx';

const WIKIPEDIA_SOURCE_URL = 'https://en.wikipedia.org/wiki/List_of_presidents_of_the_United_States';

export default function HomeScreen() {
  const { presidents, viewedIDs, nextRandomPresident, resetViewed } = useAppModel();
  const { pushList, replaceWithDetail } = useNavigation();
  const slideshow = useSlideshow();

  const remainingCount = presidents.length - viewedIDs.size;

  return (
    <div className="home">
      <div className="icon">
        <Icon name="bank" size={64} />
      </div>
      <h1>US Presidents</h1>
      <p className="subtitle">Browse portraits and biographies of every US president.</p>

      <div className="actions">
        <button className="btn btn-bordered" onClick={pushList}>
          <Icon name="list-ul" />
          List of Presidents
        </button>
        <button className="btn btn-bordered" onClick={() => replaceWithDetail(nextRandomPresident())}>
          <Icon name="shuffle" />
          Random President
        </button>
        <button className="btn btn-bordered" onClick={slideshow.toggle}>
          <Icon name={slideshow.isRunning ? 'stop-circle-fill' : 'play-circle-fill'} />
          {slideshow.isRunning ? 'Stop Slideshow' : 'Start Slideshow'}
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
