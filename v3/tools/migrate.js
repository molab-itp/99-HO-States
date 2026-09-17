#!/usr/bin/env node
// One-time migration: copy president portraits out of the v2 Xcode asset catalog and
// regenerate a plain JSON data file for the v3 plain-JS app.
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const v2Root = path.join(repoRoot, 'v2', 'US-Headers', 'US-Headers');
const assetsRoot = path.join(v2Root, 'Assets.xcassets');
const sourceJSONPath = path.join(v2Root, 'Resources', 'Presidents.json');

const outImagesDir = path.join(__dirname, '..', 'images');
const outDataDir = path.join(__dirname, '..', 'data');

fs.mkdirSync(outImagesDir, { recursive: true });
fs.mkdirSync(outDataDir, { recursive: true });

const presidents = JSON.parse(fs.readFileSync(sourceJSONPath, 'utf8'));

function copyImageSet(imageSetName, destBaseName) {
  if (!imageSetName) return null;
  const imageSetDir = path.join(assetsRoot, `${imageSetName}.imageset`);
  if (!fs.existsSync(imageSetDir)) return null;
  const file = fs.readdirSync(imageSetDir).find((name) => name !== 'Contents.json');
  if (!file) return null;
  const ext = path.extname(file);
  const destName = `${destBaseName}${ext}`;
  fs.copyFileSync(path.join(imageSetDir, file), path.join(outImagesDir, destName));
  return `images/${destName}`;
}

const output = presidents
  .sort((a, b) => a.order - b.order)
  .map((president) => {
    const orderPadded = String(president.order).padStart(2, '0');
    const thumbnail = copyImageSet(president.thumbnailImageName, `${orderPadded}-thumb`);
    const large = copyImageSet(president.largeImageName, `${orderPadded}-large`);
    return {
      order: president.order,
      name: president.name,
      term: president.term,
      party: president.party,
      wikipediaTitle: president.wikipediaTitle,
      extract: president.extract,
      thumbnail,
      large,
    };
  });

fs.writeFileSync(path.join(outDataDir, 'presidents.json'), JSON.stringify(output, null, 2) + '\n');

console.log(`Copied images for ${output.length} presidents into ${outImagesDir}`);
console.log(`Wrote ${path.join(outDataDir, 'presidents.json')}`);
