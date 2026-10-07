import raw from './news.json';

// v2 names each thumbnail after an image in its asset catalog; here those images are files under
// public/images/news/. A name with no entry (or none at all) shows the placeholder instead.
const THUMBNAIL_FILES = {
  '99-black-icon': 'images/news/99-black-icon.png',
  'Ava-icon': 'images/news/Ava-icon.png',
  'Guardian-icon': 'images/news/Guardian-icon.png',
  'HCR-icon': 'images/news/HCR-icon.png',
  'Jan6-icon': 'images/news/Jan6-icon.png',
  'Reich-icon': 'images/news/Reich-icon.png',
  'Tad-icon': 'images/news/Tad-icon.jpg',
  'Wolff-icon': 'images/news/Wolff-icon.png',
};

// Mirrors NewsRepository.loadAll(): the news entries shown on the News screen, in news.json order.
const news = raw.map((item) => ({ ...item, thumbnail: THUMBNAIL_FILES[item.thumbnail] ?? null }));

export default news;
