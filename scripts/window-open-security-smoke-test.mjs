import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractPublishedSlugs } from './test-support/published-minigames.mjs';

const root = resolve(import.meta.dirname, '..');
const catalog = readFileSync(resolve(root, 'minigames.html'), 'utf8');
const runtimeFiles = [
  'assets/js/main.js',
  ...extractPublishedSlugs(catalog).flatMap((slug) => [
    `${slug}/script.js`,
    `${slug}/game.js`,
    `${slug}/core.js`,
    `${slug}/editor.js`,
  ]),
];

const checked = [];
for (const relativePath of runtimeFiles) {
  let source;
  try {
    source = readFileSync(resolve(root, relativePath), 'utf8');
  } catch (_) {
    continue;
  }

  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.includes('window.open(')) return;
    checked.push(`${relativePath}:${index + 1}`);
    assert.match(
      line,
      /noopener/,
      `${relativePath}:${index + 1}: window.open must request noopener`
    );
  });
}

assert.ok(checked.length > 0, 'expected at least one public runtime window.open call to audit');
console.log(`window.open security smoke test passed (${checked.length} calls)`);
