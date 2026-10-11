import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sitePages, navigationMarkup } from './site-config.mjs';
const root = resolve(import.meta.dirname, '..');
const write = process.argv.includes('--write');
const failures = [];
for (const page of sitePages) {
  const path = resolve(root, page);
  const source = readFileSync(path, 'utf8');
  const region = /<!-- site-nav:start -->[\s\S]*?<!-- site-nav:end -->/;
  if (!region.test(source)) throw new Error(`${page}: navigation region is missing`);
  const next = source.replace(region, navigationMarkup(page));
  if (next !== source) {
    if (write) writeFileSync(path, next);
    else failures.push(page);
  }
}
if (failures.length) throw new Error(`Navigation differs from shared source: ${failures.join(', ')}. Run npm run sync:site.`);
console.log(`shared navigation ${write ? 'synchronized' : 'verified'} (${sitePages.length} pages)`);
