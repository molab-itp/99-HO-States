/**
 * The app's version and build number, e.g. "Version 0.7.5 (1021)": the version from package.json,
 * the build from the iOS app's Xcode project (see `define` in vite.config.js).
 * `small` is the iOS app's `font: .caption2`.
 */
export default function AppVersionLabel({ small = false }) {
  return (
    <p className={small ? 'version-label version-label-small' : 'version-label'}>
      Version {__APP_VERSION__} ({__APP_BUILD__})
    </p>
  );
}
