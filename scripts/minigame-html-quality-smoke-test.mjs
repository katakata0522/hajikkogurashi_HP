import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const games = [
  'kanji-slicer',
  'lumen-mirror',
  'blackhole-sweeper',
  'girigiri-brake',
  'sorting-factory',
  'stealth-slacker',
  'mikiri-issen',
  'wall-jumper',
  'kage-mane-dojo',
];

for (const game of games) {
  const path = resolve(root, game, 'index.html');
  const html = readFileSync(path, 'utf8');
  const label = `${game}/index.html`;

  const descriptionCount = (html.match(/<meta\s+name=["']description["']/gi) || []).length;
  assert.equal(descriptionCount, 1, `${label}: meta description must appear exactly once`);

  const canonicalCount = (html.match(/<link\s+rel=["']canonical["']/gi) || []).length;
  assert.equal(canonicalCount, 1, `${label}: canonical link must appear exactly once`);

  assert.equal(
    html.includes('hajikkoroom.xsrv.jp//assets/'),
    false,
    `${label}: absolute social/asset URL must not contain a double slash after host`,
  );

  const bodyStart = html.search(/<body\b/i);
  assert.ok(bodyStart >= 0, `${label}: body element must exist`);
  assert.equal(
    /<meta\b/i.test(html.slice(bodyStart)),
    false,
    `${label}: SEO metadata must stay in head`,
  );
}

console.log(`minigame HTML quality smoke test passed (${games.length} games)`);
