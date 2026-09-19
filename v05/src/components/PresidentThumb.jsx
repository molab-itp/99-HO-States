import { useState } from 'react';
import { assetUrl } from '../data/assetUrl.js';

/** Port of PresidentRow's `thumbnail`: falls back to a generic person glyph if the image 404s. */
export default function PresidentThumb({ president }) {
  const [failed, setFailed] = useState(false);
  const src = president.thumbnail;

  if (!src || failed) {
    return (
      <div className="president-thumb president-thumb-placeholder" aria-hidden="true">
        👤
      </div>
    );
  }

  return (
    <img
      className="president-thumb"
      src={assetUrl(src)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
