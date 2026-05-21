import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'lumen-mirror', 'index.html'), 'utf8');
const script = readFileSync(resolve(root, 'lumen-mirror', 'script.js'), 'utf8');
const style = readFileSync(resolve(root, 'lumen-mirror', 'style.css'), 'utf8');

// HTML Elements Assertions
assert.match(html, /id="game-canvas"/, 'canvas element should be present');
assert.match(html, /id="emit-btn"/, 'emit button should be present');
assert.match(html, /id="reset-btn"/, 'reset button should be present');

// Syntax Check
assert.doesNotThrow(() => new vm.Script(script), 'LUMEN_MIRROR script must be valid JavaScript');

// JS Object and Logic Assertions
assert.match(script, /class\s+AudioManager/, 'AudioManager should be implemented for Web Audio API');
assert.match(script, /class\s+Mirror/, 'Mirror entity class should be implemented');
assert.match(script, /class\s+Emitter/, 'Emitter entity class should be implemented');
assert.match(script, /class\s+Prism/, 'Prism entity class should be implemented');
assert.match(script, /class\s+BlackHole/, 'BlackHole entity class should be implemented');
assert.match(script, /getIntersection\(/, 'Line intersection algorithm should be implemented');

// Styling Assertions
assert.match(style, /--bg-dark:\s*#050508/, 'dark theme should be defined in CSS');
assert.match(style, /#game-container/, 'game container should be styled');
assert.match(style, /\.grid-overlay/, 'industrial grid overlay should be styled');

console.log('LUMEN_MIRROR スモークテスト: 完了 (すべての検証がパスしました)');
