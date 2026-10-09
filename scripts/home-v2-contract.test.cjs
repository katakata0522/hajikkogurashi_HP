'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('index.html');
const css = read('assets/css/home-v2.css');
const js = read('assets/js/home-v2.js');

test('V2 homepage is independent static HTML with canonical and sharing metadata', () => {
  assert.match(html, /<html\s+lang="ja">/);
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width/);
  assert.match(html, /<link rel="canonical" href="https:\/\/hajikkoroom\.xsrv\.jp\/" \/>/);
  assert.match(html, /<meta\s+property="og:image"\s+content="https:\/\/hajikkoroom\.xsrv\.jp\//);
  assert.match(html, /<meta\s+name="twitter:card"/);
  assert.doesNotMatch(html, /<\?php|\{[%{]/);
  assert.doesNotMatch(html, /<style\b/i);
});

test('V2 has a single main heading and all internal section navigation lands correctly', () => {
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), item => item[1]);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate id attributes');
  const localTargets = Array.from(html.matchAll(/\bhref="#([^"]+)"/g), item => item[1]);
  for (const target of localTargets) {
    assert.ok(ids.includes(target), 'missing anchor #' + target);
  }
  for (const id of ['main', 'about', 'works', 'play', 'journal', 'people', 'contact']) {
    assert.ok(ids.includes(id), 'missing homepage section ' + id);
  }
});

test('V2 navigation remains accessible in keyboard and small-screen use', () => {
  assert.match(html, /class="menu-toggle"[^>]*aria-controls="mobile-menu"[^>]*aria-expanded="false"/);
  assert.match(html, /class="mobile-menu"[^>]*id="mobile-menu"[^>]*\binert/);
  assert.match(js, /Escape/);
  assert.match(js, /restoreFocus/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max-width:\s*380px/);
  assert.doesNotThrow(() => new vm.Script(js, { filename: 'home-v2.js' }));
});

test('V2 local pages and featured mini-games correspond to real site routes', () => {
  for (const page of ['portfolio.html', 'minigames.html', 'news.html', 'members.html', 'privacy-policy.html', 'terms-of-service.html']) {
    assert.ok(html.includes('href="/' + page + '"'), 'missing link to ' + page);
    assert.ok(fs.existsSync(path.join(root, page)), 'missing destination ' + page);
  }
  const gamesPage = read('minigames.html');
  for (const game of ['kanji-slicer', 'mikiri-issen', 'stealth-slacker']) {
    assert.ok(html.includes('href="/' + game + '/"'), 'missing featured game ' + game);
    assert.ok(gamesPage.includes('href="/' + game + '/"'), 'game ' + game + ' not on games index');
  }
  const memberPage = read('members.html');
  for (const name of ['Vorei', 'Kei', 'Go']) {
    assert.ok(html.includes('<h3>' + name + '</h3>'), 'missing featured member ' + name);
    assert.ok(memberPage.includes('>' + name + '</h3>'), 'member ' + name + ' not on member index');
  }
  assert.doesNotMatch(html, /逃亡おじさん|V2 CONCEPT/);
});

test('V2 loads paired revisioned CSS and JS and exposes a contact path', () => {
  const style = html.match(/href="\/assets\/css\/home-v2\.css\?v=([^"]+)"/);
  const script = html.match(/src="\/assets\/js\/home-v2\.js\?v=([^"]+)"/);
  assert.ok(style && script);
  assert.equal(style[1], script[1]);
  assert.match(html, /href="mailto:[^"]+"/);
  assert.doesNotMatch(html, /src="\/assets\/js\/main\.js/);
});
