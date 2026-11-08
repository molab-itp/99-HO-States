import { useState } from 'react';
import { assetUrl } from '../data/assetUrl.js';
import Icon from './Icon.jsx';

/** Port of NewsRow's `thumbnail`: falls back to a newspaper glyph if there is no image or it 404s. */
export default function NewsThumb({ item }) {
  const [failed, setFailed] = useState(false);
  const src = item.thumbnail;

  if (!src || failed) {
    return (
      <div className="news-thumb news-thumb-placeholder">
        <Icon name="newspaper" size={28} />
      </div>
    );
  }

  return (
    <img
      className="news-thumb"
      src={assetUrl(src)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
