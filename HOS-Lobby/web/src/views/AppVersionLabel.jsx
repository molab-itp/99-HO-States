/**
 * The app's version, e.g. "Version 0.7.0", from package.json (see `define` in vite.config.js).
 * `small` is v06's `font: .caption2`.
 */
export default function AppVersionLabel({ small = false }) {
  return <p className={small ? 'version-label version-label-small' : 'version-label'}>Version {__APP_VERSION__}</p>;
}
