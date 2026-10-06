import raw from './news.json';

// v2 names each thumbnail after an image in its asset catalog; here those images are files under
// public/images/news/. A name with no entry (or none at all) shows the placeholder instead.
const THUMBNAIL_FILES = {
  'Ava-icon': 'images/news/Ava-icon.png',
  'Tad-icon': 'images/news/Tad-icon.jpg',
};

// Mirrors NewsRepository.loadAll(): the news entries shown on the News screen, in news.json order.
const news = raw.map((item) => ({ ...item, thumbnail: THUMBNAIL_FILES[item.thumbnail] ?? null }));

export default news;
