import { assetUrl } from '../data/assetUrl.js';
import Icon from './Icon.jsx';
import SpeechPlayButton from './SpeechPlayButton.jsx';

/**
 * Port of GreatestFigureView.swift: a Greatest figure's full photo, name, dates, description,
 * summary and Wikipedia link. The body of `GreatestDetailScreen`, and repeated for each figure at
 * the bottom of `HOSDetailScreen`. Given a `speechPlayer` (as `GreatestDetailScreen` does), a
 * play/pause button by the name speaks the summary — or, with `speaksName` on, the order and name
 * — and `autoSpeaks` turning on starts it without a tap. The owner of `speechPlayer` stops it when
 * the person changes.
 */
export default function GreatestFigure({ person, speechPlayer = null, autoSpeaks = false, speaksName = false }) {
  const speechText = speaksName ? `${person.order} ${person.name}` : person.summary;

  return (
    <div className="greatest-figure">
      <img className="greatest-photo" src={assetUrl(person.large)} alt={person.name} loading="lazy" />
      <div className="name-row">
        <h2>{person.name}</h2>
        {speechPlayer && (
          <SpeechPlayButton player={speechPlayer} text={speechText} translatesFirst autoPlays={autoSpeaks} />
        )}
      </div>
      <p className="greatest-description">{person.description}</p>
      <p>{person.summary}</p>
      <a className="wiki-link" href={person.articleUrl} target="_blank" rel="noopener noreferrer">
        <Icon name="book" size={14} />
        Read on Wikipedia
      </a>
    </div>
  );
}
