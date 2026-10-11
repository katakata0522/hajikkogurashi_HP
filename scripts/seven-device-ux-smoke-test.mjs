import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const games = [
  'blackhole-sweeper', 'girigiri-brake', 'kage-mane-dojo',
  'mikiri-issen', 'sorting-factory', 'stealth-slacker', 'wall-jumper',
];
for (const slug of games) {
  const css = readFileSync(resolve(root, slug, 'style.css'));
  const html = readFileSync(resolve(root, slug, 'index.html'), 'utf8');
  const digest = createHash('sha256').update(css).digest('hex').slice(0, 12);
  const prefix = slug === 'kage-mane-dojo' ? './' : '';
  assert.ok(html.includes(`href="${prefix}style.css?v=${digest}"`), `${slug}: stale CSS URL`);
  assert.ok(css.toString('utf8').includes('Corner Neighbor device-UX pass'), `${slug}: responsive contract missing`);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1\.0/i,
    `${slug}: avoid disabling pinch zoom`);
}
const dojoStyle = readFileSync(resolve(root, 'kage-mane-dojo/style.css'), 'utf8');
assert.match(dojoStyle, /\.play-screen\.active\s*\{[^}]*display\s*:\s*grid/s,
  'low-height landscape dojo requires separate arena and button column');
const wallStyle = readFileSync(resolve(root, 'wall-jumper/style.css'), 'utf8');
assert.match(wallStyle, /#menu-btn-title\s*\{[^}]*position\s*:\s*absolute/s,
  'Wall Jumper return button must not cover the title');
const sortingHtml = readFileSync(resolve(root, 'sorting-factory/index.html'), 'utf8');
assert.match(sortingHtml, /class="start-actions"/, 'sorting title actions must be one layout unit');
console.log(`seven-game device UX smoke passed (${games.length} CSS digests and layout contracts)`);
