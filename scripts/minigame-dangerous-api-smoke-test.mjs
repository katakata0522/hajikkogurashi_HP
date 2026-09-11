import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { extractPublishedSlugs } from './test-support/published-minigames.mjs';

const root = resolve(import.meta.dirname, '..');
const catalog = readFileSync(resolve(root, 'minigames.html'), 'utf8');
const published = extractPublishedSlugs(catalog);

const forbidden = [
  { label: 'eval()', pattern: /\beval\s*\(/ },
  { label: 'new Function()', pattern: /\bnew\s+Function\s*\(/ },
  { label: 'Function constructor', pattern: /\bFunction\s*\(\s*['"`]/ },
  { label: 'document.write()', pattern: /\bdocument\s*\.\s*write(?:ln)?\s*\(/ },
];

function collectRuntimeSources(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolute = resolve(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      files.push(...collectRuntimeSources(absolute));
      continue;
    }
    if (['.js', '.mjs', '.html'].includes(extname(entry).toLowerCase())) files.push(absolute);
  }
  return files;
}

const violations = [];
for (const slug of published) {
  const gameRoot = resolve(root, slug);
  for (const absolute of collectRuntimeSources(gameRoot)) {
    const source = readFileSync(absolute, 'utf8');
    for (const rule of forbidden) {
      if (rule.pattern.test(source)) {
        violations.push(`${slug}/${absolute.slice(gameRoot.length + 1).replaceAll('\\', '/')}: ${rule.label}`);
      }
    }
  }
}

assert.equal(
  violations.length,
  0,
  `published minigames must not use dangerous dynamic execution APIs:\n${violations.map((item) => `- ${item}`).join('\n')}`
);

console.log(`minigame dangerous API gate passed (${published.length} games)`);
