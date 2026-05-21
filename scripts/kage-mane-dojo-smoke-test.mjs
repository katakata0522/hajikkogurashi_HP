import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = resolve(root, 'kage-mane-dojo');
const htmlPath = resolve(gameDir, 'index.html');
const cssPath = resolve(gameDir, 'style.css');
const scriptPath = resolve(gameDir, 'script.js');
const minigamesPath = resolve(root, 'minigames.html');

assert.ok(existsSync(htmlPath), 'kage-mane-dojo/index.html should exist');
assert.ok(existsSync(cssPath), 'kage-mane-dojo/style.css should exist');
assert.ok(existsSync(scriptPath), 'kage-mane-dojo/script.js should exist');

const html = readFileSync(htmlPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
const script = readFileSync(scriptPath, 'utf8');
const minigames = readFileSync(minigamesPath, 'utf8');

assert.doesNotThrow(() => new vm.Script(script), 'kage-mane-dojo script should be valid JavaScript');

assert.match(html, /<title>影まね道場/, 'page title should identify the game');
assert.match(html, /id="master"/, 'game should have a master character');
assert.match(html, /id="student"/, 'game should have a student character');
assert.match(html, /data-direction="up"[\s\S]*data-direction="right"[\s\S]*data-direction="down"[\s\S]*data-direction="left"/, 'game should expose four direction buttons');
assert.match(script, /const DIRECTIONS = \['up', 'right', 'down', 'left'\]/, 'game should use four-direction sequence memory');
assert.match(script, /baseLength:\s*3/, 'first lesson should start with three moves');
assert.match(script, /sequence\.push/, 'each lesson should generate a sequence to imitate');
assert.match(script, /const STORAGE_KEY = 'kage-mane-dojo-record';/, 'best record should use a stable storage key');
assert.match(script, /localStorage\.getItem\(STORAGE_KEY\)/, 'best record should persist locally');
assert.match(css, /\.dojo-scene/, 'game should render a distinct dojo scene');
assert.match(minigames, /href="\/kage-mane-dojo\/"/, 'minigames page should link to the new game');
assert.match(minigames, /影まね道場/, 'minigames page should list the new game by name');

assert.doesNotMatch(`${html}\n${script}\n${css}`, /ピッピ|ポケモン|ゆびふり|教室/, 'game should avoid source-specific names and presentation');
