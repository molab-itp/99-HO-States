import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// The version and build number are the iOS app's (`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`
// in the Xcode project), so both apps report the same "Version 0.8 (1022)". The version falls back to
// package.json and the build to '?' if the project file can't be read, as AppVersionLabel.swift does.
function iosSetting(name) {
  try {
    const pbxproj = readFileSync(
      new URL('../HOS-Lobby/HOS-Lobby.xcodeproj/project.pbxproj', import.meta.url),
      'utf8',
    );
    return pbxproj.match(new RegExp(`${name} = ([\\w.]+);`))?.[1];
  } catch {
    return undefined;
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
  define: {
    __APP_VERSION__: JSON.stringify(iosSetting('MARKETING_VERSION') ?? version),
    __APP_BUILD__: JSON.stringify(iosSetting('CURRENT_PROJECT_VERSION') ?? '?'),
   },
}));
