import { useState } from 'react';
import Icon from './Icon.jsx';

/**
 * A round photo, as `AsyncImage` in a `Circle` clip: the person placeholder shows until `url`
 * has loaded, and stays if there is none or it fails.
 */
export default function Avatar({ url, size = 44 }) {
  // Keyed by URL, so a new photo starts from the placeholder again.
  const [loadedURL, setLoadedURL] = useState(null);
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      <Icon name="person-circle" size={size} />
      {url && (
        <img
          key={url}
          src={url}
          alt=""
          style={{ opacity: loadedURL === url ? 1 : 0 }}
          onLoad={() => setLoadedURL(url)}
        />
      )}
    </span>
  );
}
