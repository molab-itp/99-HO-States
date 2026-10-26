import { assetUrl } from '../data/assetUrl.js';
import { greatestSourceURL } from '../data/greatest.js';
import Icon from './Icon.jsx';
import SpeechPlayButton from './SpeechPlayButton.jsx';

/**
 * Port of GreatestFigureView.swift: a Greatest figure's full photo, name, dates, description,
 * summary, and links to its Wikipedia article and to the list's source. The body of `GreatestDetailScreen`, and repeated for each figure at
 * the bottom of `HOSDetailScreen`. Given a `speechPlayer`, a play/pause button by the name speaks
 * the summary — or, per `speechMode`, the order and name, or the name and description — and
 * `autoSpeaks` turning on starts it without a tap. The owner of `speechPlayer` stops it when the
 * person changes.
 */
export default function GreatestFigure({ person, speechPlayer = null, autoSpeaks = false, speechMode = 'summary' }) {
  const speechText =
    speechMode === 'name'
      ? `${person.order} ${person.name}`
      : speechMode === 'caption'
        ? `${person.name}. ${person.description}`
        : person.summary;

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
      <div className="link-pair">
        <a className="wiki-link" href={person.articleUrl} target="_blank" rel="noopener noreferrer">
          <Icon name="book" size={14} />
          Article
        </a>
        <a className="wiki-link" href={greatestSourceURL} target="_blank" rel="noopener noreferrer">
          <Icon name="book" size={14} />
          Source
        </a>
      </div>
    </div>
  );
}
