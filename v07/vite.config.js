import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Deployed to GitHub Pages as a project site with each version under its own subfolder
// (https://molab-itp.github.io/99-HO-States/v07/), so the production build needs that prefix as
// its base — overridable via VITE_BASE_PATH for a fork under a different repo name. Dev stays at
// '/' so `npm run dev` keeps working unprefixed.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE_PATH || '/99-HO-States/v07/' : '/',
  plugins: [react()],
  // Shown by AppVersionLabel.
  define: { __APP_VERSION__: JSON.stringify(version) },
}));
