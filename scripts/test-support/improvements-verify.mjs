import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

console.log('--- 1. PWA Manifest Verification ---');
const manifestPath = resolve(root, 'manifest.webmanifest');
assert.ok(existsSync(manifestPath), 'manifest.webmanifest must exist');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.name, 'Corner Neighbor - レトロインディーゲームスタジオ');
assert.equal(manifest.short_name, 'CornerNeighbor');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.theme_color, '#08070f');
assert.equal(manifest.background_color, '#08070f');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest must define icons');
for (const icon of manifest.icons) {
  const iconFilePath = resolve(root, icon.src.replace(/^\//, ''));
  assert.ok(existsSync(iconFilePath), `Icon file must exist: ${icon.src}`);
}
console.log('✓ manifest.webmanifest is valid and icons exist');

// Verify manifest link in HTML files
const htmlFiles = [
  'index.html',
  'minigames.html',
  'news.html',
  'aboutus.html',
  'portfolio.html',
  'members.html',
  'coming-soon.html',
  '404.html',
  'privacy-policy.html',
  'terms-of-service.html',
  'mikiri-issen/index.html',
  'wall-jumper/index.html',
  'kage-mane-dojo/index.html',
  'kanji-slicer/index.html',
  'lumen-mirror/index.html',
  'girigiri-brake/index.html',
  'blackhole-sweeper/index.html',
  'sorting-factory/index.html',
  'stealth-slacker/index.html',
];
for (const rel of htmlFiles) {
  const content = readFileSync(resolve(root, rel), 'utf8');
  assert.ok(
    content.includes('rel="manifest"') && content.includes('/manifest.webmanifest'),
    `${rel} must link to /manifest.webmanifest`
  );
}
console.log(`✓ All ${htmlFiles.length} HTML files link to /manifest.webmanifest`);

console.log('\n--- 2. Game OGP Thumbnails Verification ---');
const ogpChecks = [
  { file: 'mikiri-issen/index.html', thumb: 'mikiri_issen_thumbnail_1779165128314.png' },
  { file: 'wall-jumper/index.html', thumb: 'wall_jumper_thumbnail_1779165143429.png' },
  { file: 'kage-mane-dojo/index.html', thumb: 'kage_mane_dojo_thumbnail.svg' },
];
for (const check of ogpChecks) {
  const content = readFileSync(resolve(root, check.file), 'utf8');
  assert.ok(
    content.includes(`og:image" content="https://hajikkoroom.xsrv.jp/assets/images/${check.thumb}"`),
    `${check.file} og:image must point to ${check.thumb}`
  );
  assert.ok(
    content.includes(`twitter:image" content="https://hajikkoroom.xsrv.jp/assets/images/${check.thumb}"`),
    `${check.file} twitter:image must point to ${check.thumb}`
  );
  const assetPath = resolve(root, 'assets/images', check.thumb);
  assert.ok(existsSync(assetPath), `Thumbnail asset must exist: ${check.thumb}`);
}
console.log('✓ All targeted games have dedicated OGP thumbnails and assets exist');

console.log('\n--- 3. View Transitions API Verification ---');
const vtScriptPath = resolve(root, 'assets/js/view-transitions.js');
assert.ok(existsSync(vtScriptPath), 'assets/js/view-transitions.js must exist');
const vtScript = readFileSync(vtScriptPath, 'utf8');
assert.ok(vtScript.includes('startViewTransition'), 'view-transitions.js must use startViewTransition');

const tailwindCss = readFileSync(resolve(root, 'assets/css/tailwind.prod.min.css'), 'utf8');
assert.ok(tailwindCss.includes('@view-transition'), 'tailwind.prod.min.css must include @view-transition');
assert.ok(tailwindCss.includes('retro-crt-snap-out'), 'tailwind.prod.min.css must define retro CRT transition');

const mainCss = readFileSync(resolve(root, 'assets/css/main.css'), 'utf8');
assert.ok(mainCss.includes('@view-transition'), 'main.css must include @view-transition');

const customCss = readFileSync(resolve(root, 'assets/css/custom.css'), 'utf8');
assert.ok(customCss.includes('@view-transition'), 'custom.css must include @view-transition');

console.log('✓ View Transitions script and CSS rules verified');

console.log('\n--- 4. Mini CRT Shortcuts & Persistence Verification ---');
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf8');
assert.ok(indexHtml.includes('cn_crt_best_brake'), 'index.html must use cn_crt_best_brake');
assert.ok(indexHtml.includes('cn_crt_best_mikiri'), 'index.html must use cn_crt_best_mikiri');
assert.ok(indexHtml.includes('cn_crt_best_mirror'), 'index.html must use cn_crt_best_mirror');
assert.ok(indexHtml.includes('cn_crt_best_duel'), 'index.html must use cn_crt_best_duel');
assert.ok(indexHtml.includes('triggerCrtNewRecord'), 'index.html must define triggerCrtNewRecord');
assert.ok(indexHtml.includes('crtNewRecordAnim'), 'index.html must handle crtNewRecordAnim');
assert.ok(indexHtml.includes("key === '1' || key === '2' || key === '3' || key === '4'"), 'index.html must handle 1-4 keys');
assert.ok(indexHtml.includes("key === 'r' || key === 'R'"), 'index.html must handle R key');
assert.ok(indexHtml.includes('crt-kbd'), 'index.html must include crt-kbd retro keycaps');
console.log('✓ Mini CRT keyboard shortcuts and score persistence verified in index.html');

console.log('\nAll static & logical improvements verified successfully!');
