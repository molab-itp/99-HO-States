import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { allRoutePaths } from './src/data/route.js';

// Page links (src/data/route.js) are paths like `News` and `HOS/16`, which a static host has no
// file for. So the build leaves a copy of index.html at each one (`News.html`, `HOS/16.html` —
// GitHub Pages serves `News.html` for `/News`), and the app shows the screen the address names.
function pageLinks() {
  let outDir;
  return {
    name: 'page-links',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const hosList = JSON.parse(readFileSync(new URL('./src/data/hos.json', import.meta.url), 'utf8'));
      for (const routePath of allRoutePaths(hosList)) {
        const file = path.join(outDir, `${routePath}.html`);
        mkdirSync(path.dirname(file), { recursive: true });
        copyFileSync(path.join(outDir, 'index.html'), file);
      }
    },
  };
}

// Deployed to GitHub Pages as a project site with each version under its own subfolder
// (https://molab-itp.github.io/99-HO-States/v05/), so the production build needs that prefix as
// its base — overridable via VITE_BASE_PATH for a fork under a different repo name. Dev stays at
// '/' so `npm run dev` keeps working unprefixed.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE_PATH || '/99-HO-States/v05/' : '/',
  plugins: [react(), pageLinks()],
}));
