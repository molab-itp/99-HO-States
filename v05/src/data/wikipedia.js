// Mirrors President.wikipediaArticleURL: prefers an explicit articleURL (not present in the
// current data set) and otherwise builds the canonical URL from wikipediaTitle.
export function wikipediaArticleURL(president) {
  if (president.articleURL) return president.articleURL;
  const encodedTitle = president.wikipediaTitle.replace(/ /g, '_');
  return `https://en.wikipedia.org/wiki/${encodedTitle}`;
}
