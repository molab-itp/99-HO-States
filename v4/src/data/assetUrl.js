// Public/ assets (the portrait images) are referenced by hand-built strings from
// presidents.json, not static imports, so Vite's `base` rewriting doesn't reach them
// automatically — this does it explicitly so they resolve under a subfolder deploy (GitHub
// Pages) as well as at the dev server's root.
export function assetUrl(relativePath) {
  return `${import.meta.env.BASE_URL}${relativePath}`;
}
