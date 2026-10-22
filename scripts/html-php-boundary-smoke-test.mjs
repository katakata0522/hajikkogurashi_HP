// 公開サイトにPHPを置かず、旧URLからもメール連絡へ進める契約を守る。
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
    else {
      assert.doesNotMatch(entry.name, /\.(?:php[0-9]*|phtml|phar)$/i,
        `${path.relative(root, file)} must not be published as executable PHP`);
      if (/\.html?$/i.test(entry.name)) {
        const html = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(html, /<\?(?!xml\b)/i,
          `${path.relative(root, file)} contains a PHP opening tag`);
        assert.doesNotMatch(html, /(?:href|action)\s*=\s*["'][^"']*\.php(?:[?#"']|$)/i,
          `${path.relative(root, file)} still sends visitors to retired PHP`);
      }
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
assert.doesNotMatch(html, /<form\b/i, 'The retired form must not collect unsendable messages');
assert.match(html, /href="mailto:hajikkogurashi\.official@gmail\.com"[^>]*>メールアプリを開く<\/a>/);
assert.match(html, /id="contact"/);
const concept = fs.readFileSync(path.join(root, 'concept/index.html'), 'utf8');
assert.match(concept, /href="\/#dispatch">お問い合わせ<\/a>/);
const redirects = [...config.matchAll(/^RedirectMatch\s+303\s+"([^"\n]+)"\s+"([^"\n]+)"$/gm)]
  .map(m => ({ pattern: new RegExp(m[1]), target: m[2] }));
for (const [url, target] of [
  ['/contact.php', 'https://hajikkoroom.xsrv.jp/#dispatch'],
  ['/includes/contact-section.php', 'https://hajikkoroom.xsrv.jp/index_legacy.html#contact'],
  ['/includes/news-data.php', 'https://hajikkoroom.xsrv.jp/news.html'],
]) {
  const matching = redirects.filter(r => r.pattern.test(url));
  assert.equal(matching.length, 1, `Expected one static redirect for ${url}`);
  assert.equal(matching[0].target, target);
}
for (const url of ['/other.php', '/contact.php.extra', '/other/contact.php']) {
  assert.equal(redirects.some(r => r.pattern.test(url)), false, `Redirect scope too broad: ${url}`);
}
console.log('HTML/PHP boundary: zero PHP files, email contact and scoped legacy redirects OK');
