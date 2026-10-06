import { useState } from 'react';
import { assetUrl } from '../data/assetUrl.js';
import Icon from './Icon.jsx';

/** Port of HOSRow's `thumbnail`: falls back to a generic person glyph if the image 404s. */
export default function HOSThumb({ hos }) {
  const [failed, setFailed] = useState(false);
  const src = hos.thumbnail;

  if (!src || failed) {
    return (
      <div className="hos-thumb hos-thumb-placeholder">
        <Icon name="person-circle" size={22} />
      </div>
    );
  }

  return (
    <img
      className="hos-thumb"
      src={assetUrl(src)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
