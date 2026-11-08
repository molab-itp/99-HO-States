// Mirrors HOS.wikipediaArticleURL: prefers an explicit articleURL (not present in the
// current data set) and otherwise builds the canonical URL from wikipediaTitle.
export function wikipediaArticleURL(hos) {
  if (hos.articleURL) return hos.articleURL;
  const encodedTitle = hos.wikipediaTitle.replace(/ /g, '_');
  return `https://en.wikipedia.org/wiki/${encodedTitle}`;
}
