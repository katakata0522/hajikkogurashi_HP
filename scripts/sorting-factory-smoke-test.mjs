import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'sorting-factory', 'index.html');
const scriptPath = resolve(root, 'sorting-factory', 'script.js');
const html = readFileSync(htmlPath, 'utf8');
const script = readFileSync(scriptPath, 'utf8');
const style = readFileSync(resolve(root, 'sorting-factory', 'style.css'), 'utf8');

assert.match(html, /<canvas id="game-canvas"><\/canvas>/, 'game canvas should be present');
assert.doesNotThrow(() => new vm.Script(script), 'sorting-factory script must be valid JavaScript');

assert.match(
  script,
  /function\s+readBestScore\(\)\s*\{[\s\S]*?try\s*\{[\s\S]*?localStorage\.getItem\('sorting_best_score'\)/,
  'best-score loading should be isolated behind a safe helper'
);

assert.match(
  script,
  /function\s+writeBestScore\(score\)\s*\{[\s\S]*?try\s*\{[\s\S]*?localStorage\.setItem\('sorting_best_score',\s*String\(score\)\)/,
  'best-score saving should be isolated behind a safe helper'
);

assert.match(
  script,
  /this\.ui\.showGameOver\(this\.score,\s*bestScore,\s*isNewRecord\);/,
  'game over should always reach the result UI after best-score handling'
);

assert.match(
  script,
  /navigator\.share/,
  'sharing should use the native Web Share API when available'
);

assert.match(
  script,
  /navigator\.clipboard\.writeText/,
  'sharing should fall back to copying the result text'
);

assert.match(
  script,
  /window\.open\([^)]*'_blank',\s*'noopener,noreferrer'\)/,
  'external share fallback should open with noopener and noreferrer'
);

assert.match(
  style,
  /\.touch-zone\s*\{[\s\S]*?pointer-events:\s*auto;/,
  'touch zones should receive pointer events above the canvas'
);

assert.doesNotMatch(
  script,
  /\bcombo\b|\bmaxCombo\b|playSort/,
  'one-miss game should not keep unused combo-era code'
);
