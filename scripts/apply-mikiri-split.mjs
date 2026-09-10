import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const htmlPath = 'mikiri-issen/index.html';
const stylePath = 'mikiri-issen/style.css';
const gamePath = 'mikiri-issen/game.js';
const smokePath = 'scripts/mikiri-issen-smoke-test.mjs';

const originalHtml = readFileSync(htmlPath, 'utf8');
let html = originalHtml;
let smoke = readFileSync(smokePath, 'utf8');

assert.equal(existsSync(stylePath), false, 'style.css must not already exist');
assert.equal(existsSync(gamePath), false, 'game.js must not already exist');

const styleMatches = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(styleMatches.length, 1, 'expected exactly one inline style block');
assert.equal(scriptMatches.length, 1, 'expected exactly one inline game script block');

const style = styleMatches[0][1].replace(/^\n/, '').replace(/\s*$/, '\n');
const game = scriptMatches[0][1].replace(/^\n/, '').replace(/\s*$/, '\n');
assert.ok(style.length > 20000, `extracted CSS is unexpectedly small: ${style.length}`);
assert.ok(game.length > 20000, `extracted game JS is unexpectedly small: ${game.length}`);

html = html.replace(styleMatches[0][0], '<link rel="stylesheet" href="style.css">');
html = html.replace(scriptMatches[0][0], '<script src="game.js"></script>');
assert.equal(/<style>[\s\S]*?<\/style>/.test(html), false, 'inline style must be removed');
assert.equal(/<script>[\s\S]*?<\/script>/.test(html), false, 'inline game script must be removed');
assert.ok(html.includes('<link rel="stylesheet" href="style.css">'), 'external stylesheet link missing');
assert.ok(html.includes('<script src="game.js"></script>'), 'external game script missing');
assert.ok(html.length < originalHtml.length / 2, 'index.html should materially shrink after extraction');

const oldSetup = `const htmlPath = resolve(root, 'mikiri-issen', 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const script = html.match(/<script>\\s*([\\s\\S]*?)\\s*<\\/script>/)?.[1] ?? '';

assert.ok(script, 'inline script should be present');
assert.doesNotThrow(() => new vm.Script(script), 'mikiri-issen inline script must be valid JavaScript');`;

const newSetup = `const htmlPath = resolve(root, 'mikiri-issen', 'index.html');
const stylePath = resolve(root, 'mikiri-issen', 'style.css');
const scriptPath = resolve(root, 'mikiri-issen', 'game.js');
const html = readFileSync(htmlPath, 'utf8');
const style = readFileSync(stylePath, 'utf8');
const script = readFileSync(scriptPath, 'utf8');

assert.match(html, /<link rel="stylesheet" href="style\\.css">/, 'Mikiri styles should load from style.css');
assert.match(html, /<script src="game\\.js"><\\/script>/, 'Mikiri game code should load from game.js');
assert.doesNotMatch(html, /<style>[\\s\\S]*?<\\/style>/, 'Mikiri should not keep the large inline style block');
assert.doesNotMatch(html, /<script>[\\s\\S]*?<\\/script>/, 'Mikiri should not keep the large inline game script');
assert.doesNotThrow(() => new vm.Script(script), 'mikiri-issen game.js must be valid JavaScript');`;

assert.ok(smoke.includes(oldSetup), 'smoke-test setup marker missing');
smoke = smoke.replace(oldSetup, newSetup);

const optionalCssAssertion = `assert.match(
  html,
  /\\.result-optional\\s*\\{\\s*display:\\s*none;\\s*\\}/,`;
const optionalCssReplacement = `assert.match(
  style,
  /\\.result-optional\\s*\\{\\s*display:\\s*none;\\s*\\}/,`;
assert.ok(smoke.includes(optionalCssAssertion), 'optional CSS assertion marker missing');
smoke = smoke.replace(optionalCssAssertion, optionalCssReplacement);

const resultCardAssertion = `assert.match(
  html,
  /\\.result-card\\s*\\{[\\s\\S]*?width:\\s*min\\(720px,\\s*100%\\);/,`;
const resultCardReplacement = `assert.match(
  style,
  /\\.result-card\\s*\\{[\\s\\S]*?width:\\s*min\\(720px,\\s*100%\\);/,`;
assert.ok(smoke.includes(resultCardAssertion), 'result-card CSS assertion marker missing');
smoke = smoke.replace(resultCardAssertion, resultCardReplacement);

writeFileSync(htmlPath, html);
writeFileSync(stylePath, style);
writeFileSync(gamePath, game);
writeFileSync(smokePath, smoke);

console.log(`Mikiri split prepared: index ${originalHtml.length} -> ${html.length} chars, CSS ${style.length}, JS ${game.length}`);
