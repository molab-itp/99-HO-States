import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// The build number is the iOS app's (`CURRENT_PROJECT_VERSION` in the Xcode project), so both
// apps report the same build. '?' if the project file can't be read, as AppVersionLabel.swift does.
function iosBuild() {
  try {
    const pbxproj = readFileSync(
      new URL('../HOS-Lobby/HOS-Lobby.xcodeproj/project.pbxproj', import.meta.url),
      'utf8',
    );
    return pbxproj.match(/CURRENT_PROJECT_VERSION = (\w+);/)?.[1] ?? '?';
  } catch {
    return '?';
  }
}

// Deployed to GitHub Pages as a project site with each version under its own subfolder
// (https://molab-itp.github.io/99-HO-States/HOS-Lobby/web/), so the production build needs that prefix as
// its base — overridable via VITE_BASE_PATH for a fork under a different repo name. Dev stays at
// '/' so `npm run dev` keeps working unprefixed.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE_PATH || '/99-HO-States/HOS-Lobby/web/' : '/',
  plugins: [react()],
  // Shown by AppVersionLabel.
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify(iosBuild()) },
}));
