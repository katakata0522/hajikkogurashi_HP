import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const htmlFiles = execFileSync('git', ['ls-files', '--', '*.html'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);

if (!htmlFiles.length) throw new Error('No tracked HTML files found');

let changed = 0;
let viewportTags = 0;

for (const path of htmlFiles) {
  const source = readFileSync(path, 'utf8');
  const updated = source.replace(
    /<meta\b(?=[^>]*\bname\s*=\s*(["'])viewport\1)[^>]*>/gi,
    (tag) => {
      viewportTags += 1;
      return tag.replace(/\bcontent\s*=\s*(["'])(.*?)\1/i, (attribute, quote, value) => {
        const parts = value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .filter((part) => !/^user-scalable\s*=\s*no$/i.test(part))
          .filter((part) => !/^maximum-scale\s*=/i.test(part));
        return `content=${quote}${parts.join(', ')}${quote}`;
      });
    }
  );

  if (updated !== source) {
    writeFileSync(path, updated, 'utf8');
    changed += 1;
  }
}

if (!viewportTags) throw new Error('No viewport meta tags found');
if (!changed) throw new Error('No zoom-restricting viewport metadata was changed');

for (const path of htmlFiles) {
  const source = readFileSync(path, 'utf8');
  const tags = source.match(/<meta\b(?=[^>]*\bname\s*=\s*(["'])viewport\1)[^>]*>/gi) || [];
  for (const tag of tags) {
    if (/user-scalable\s*=\s*no/i.test(tag)) throw new Error(`${path}: user-scalable=no remains`);
    if (/maximum-scale\s*=/i.test(tag)) throw new Error(`${path}: maximum-scale remains`);
  }
}

console.log(`Updated ${changed} HTML files; audited ${viewportTags} viewport tags.`);
