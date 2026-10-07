import { useState } from 'react';
import { useAppModel } from '../state/AppModelContext.jsx';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import news from '../data/news.js';
import photoCredits from '../data/photoCredits.js';
import { wikipediaArticleURL } from '../data/wikipedia.js';

const TEXT_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

/**
 * Port of CreditsView.swift — sources and licences of everything the app shows that it didn't
 * make itself: the Wikipedia article each summary is extracted from, the portrait photos, and the
 * pages linked from `NewsScreen`. Pushed from Landing; the caption under each title links to its
 * source, and each category can be hidden or shown from its header.
 */
export default function CreditsScreen({ onBack }) {
  const { hosList } = useAppModel();

  return (
    <div className="screen-scroll list-screen">
      <NavBar title="Credits" onBack={onBack} />
      <div className="list-group credits">
        <CreditsSection
          title="Articles"
          footer={
            <>
              Summaries are extracted from Wikipedia and are available under the{' '}
              <a href={TEXT_LICENSE_URL} target="_blank" rel="noopener noreferrer">
                Creative Commons Attribution-ShareAlike 4.0 License
              </a>
              .
            </>
          }
        >
          {hosList.map((hos) => (
            <CreditRow
              key={hos.order}
              title={`${hos.order}. ${hos.name}`}
              detail={`Wikipedia: ${hos.wikipediaTitle}`}
              url={wikipediaArticleURL(hos)}
            />
          ))}
        </CreditsSection>

        <CreditsSection
          title="Photos"
          footer="Portraits are from Wikimedia Commons. Each row links to the file's page there, with its full source and licence details."
        >
          {photoCredits.map((credit) => (
            <CreditRow
              key={credit.order}
              title={`${credit.order}. ${credit.name}`}
              detail={credit.author ? `${credit.author}\n${credit.license}` : credit.license}
              url={credit.sourceURL}
            />
          ))}
        </CreditsSection>

        <CreditsSection
          title="News"
          footer="News links and their thumbnails belong to their respective publishers."
        >
          {news.map((item) => (
            <CreditRow key={item.url} title={item.label} detail={new URL(item.url).host} url={item.url} />
          ))}
        </CreditsSection>
      </div>
    </div>
  );
}

/** One category of credits, with a header that hides or shows its rows and footer. */
function CreditsSection({ title, footer, children }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="credits-section">
      <button
        className="credits-header"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span>{title}</span>
        <Icon name="chevron-right" size={13} className={isExpanded ? 'chevron expanded' : 'chevron'} />
      </button>
      {isExpanded && (
        <>
          <ul className="hos-list">{children}</ul>
          <p className="credits-footer">{footer}</p>
        </>
      )}
    </section>
  );
}

/** A title with a caption below it; the caption links to `url`. */
function CreditRow({ title, detail, url }) {
  return (
    <li className="credit-row">
      <span className="title">{title}</span>
      <a className="caption" href={url} target="_blank" rel="noopener noreferrer">
        {detail}
      </a>
    </li>
  );
}
