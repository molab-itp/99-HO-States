/** The app's version, e.g. "Version 0.7.0", from package.json (see `define` in vite.config.js). */
export default function AppVersionLabel() {
  return <p className="version-label">Version {__APP_VERSION__}</p>;
}
