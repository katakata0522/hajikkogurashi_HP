// HTMLの静的配信と、旧ページから通常PHPへのフォーム送信を守る。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (/\.html?$/i.test(entry.name)) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /<\?(?:php\b|=|\s)/i,
        `${path.relative(root, file)} requires server-side PHP in HTML`);
    }
  }
}
visit(root);

const config = fs.readFileSync(path.join(root, '.htaccess'), 'utf8');
for (const line of config.split(/\r?\n/)) {
  if (/^\s*AddHandler\b/i.test(line)) {
    assert.doesNotMatch(line, /(?:^|\s)\.?html?(?:\s|$)/i,
      'HTML must not be mapped to an executable handler');
  }
}
assert.match(config, /^AddType application\/manifest\+json \.webmanifest$/m);

const html = fs.readFileSync(path.join(root, 'index_legacy.html'), 'utf8');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)]
  .map(m => [m[1], m[2] || '']));
const forms = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)];
assert.equal(forms.length, 1, 'The old contact form must remain available');
assert.equal(attrs(forms[0][1]).action, '/contact.php');
assert.equal(attrs(forms[0][1]).method.toLowerCase(), 'post');
const fields = [...forms[0][2].matchAll(/<(?:input|textarea)\b([^>]*)>/gi)].map(m => attrs(m[1]));
for (const name of ['name', '_replyto', 'message', 'company', 'return_to']) {
  assert.equal(fields.filter(f => f.name === name).length, 1, `Missing or duplicate ${name}`);
}
assert.equal(fields.find(f => f.name === 'return_to').value, '/');
for (const name of ['name', '_replyto', 'message']) {
  assert.ok('required' in fields.find(f => f.name === name));
}
for (const file of ['contact.php', 'includes/contact-section.php', 'includes/news-data.php']) {
  assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /^<\?php\b/);
}
console.log('HTML/PHP boundary: static HTML, legacy form and normal PHP entrypoints OK');
