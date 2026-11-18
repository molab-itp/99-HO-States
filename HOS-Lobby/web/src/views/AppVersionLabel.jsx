/**
 * The app's version and build number, e.g. "Version 0.8 (1022)": both taken from the iOS
 * app's Xcode project so the two apps match (see `define` in vite.config.js).
 * `small` is the iOS app's `font: .caption2`.
 */
export default function AppVersionLabel({ small = false }) {
  return (
    <p className={small ? 'version-label version-label-small' : 'version-label'}>
      Version {__APP_VERSION__} ({__APP_BUILD__})
    </p>
  );
}
