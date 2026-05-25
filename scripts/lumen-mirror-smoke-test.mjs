import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'lumen-mirror', 'index.html'), 'utf8');
const script = readFileSync(resolve(root, 'lumen-mirror', 'script.js'), 'utf8');
const style = readFileSync(resolve(root, 'lumen-mirror', 'style.css'), 'utf8');

// ---- HTML Structure ----
assert.match(html, /id="game-canvas"/, 'canvas should exist');
assert.match(html, /id="emit-btn"/, 'emit button should exist');
assert.match(html, /id="reset-btn"/, 'reset button should exist');
assert.match(html, /id="stage-select"/, 'stage select screen should exist');
assert.match(html, /id="stage-cards-container"/, 'stage cards container should exist');
assert.match(html, /id="mode-indicator"/, 'mode indicator should exist');
assert.match(html, /id="select-btn"/, 'stage select button in overlay should exist');
assert.match(html, /id="best-banner"/, 'best rank banner should exist');
assert.match(html, /id="stat-best"/, 'best rank stat display should exist');
assert.match(html, /href="style\.css\?v=20260525-editor-fix"/, 'editor stylesheet should be cache-busted');
assert.match(html, /src="script\.js\?v=20260525-editor-fix"/, 'editor script should be cache-busted');

// ---- JavaScript Syntax ----
assert.doesNotThrow(() => new vm.Script(script), 'script must be valid JS');

// ---- Core Classes ----
assert.match(script, /class\s+AudioManager/, 'AudioManager should be implemented');
assert.match(script, /class\s+ScoreManager/, 'ScoreManager for localStorage should be implemented');
assert.match(script, /class\s+Mirror/, 'Mirror entity should be implemented');
assert.match(script, /class\s+Emitter/, 'Emitter entity should be implemented');
assert.match(script, /class\s+Prism/, 'Prism entity should be implemented');
assert.match(script, /class\s+BlackHole/, 'BlackHole entity should be implemented');
assert.match(script, /class\s+Wormhole/, 'Wormhole portal entity should be implemented');
assert.match(script, /class\s+ParticleSystem/, 'ParticleSystem should be implemented');
assert.match(script, /class\s+GameController/, 'GameController should be implemented');

// ---- Core Logic ----
assert.match(script, /getIntersection\(/, 'Line intersection algorithm should exist');
assert.match(script, /localStorage/, 'localStorage usage should exist for score persistence');
assert.match(script, /STAGE_TEMPLATES/, 'Stage database should be defined');
assert.match(script, /STAGE_SELECT/, 'STAGE_SELECT state should exist');
assert.match(script, /playPortalWarp/, 'Portal warp sound should be implemented');
assert.match(script, /playClearChord/, 'Clear chord sound should be implemented');
assert.match(script, /chainFlashQueue/, 'Chain flash animation queue should exist');
assert.match(script, /clearRipples/, 'Clear ripple animation on prism should exist');
assert.match(script, /GRAVITY FIELD/, 'Gravity field label should be drawn');
assert.match(script, /StereoPanner|createStereoPanner/, '3D stereo panning should be present');

// ---- 7 Stages defined ----
const stageMatches = (script.match(/id:\s*\d+/g) || []).length;
assert.ok(stageMatches >= 7, `Expected at least 7 stages, found ${stageMatches}`);

// ---- CSS Design Tokens ----
assert.match(style, /--bg-dark:\s*#050508/, 'dark theme token should be set');
assert.match(style, /--color-rank-s/, 'S rank color token should exist');
assert.match(style, /#game-container/, 'game container should be styled');
assert.match(style, /\.grid-overlay/, 'grid overlay should be styled');
assert.match(style, /\.stage-card/, 'stage card style should exist');
assert.match(style, /\.mode-indicator/, 'mode indicator style should exist');
assert.match(style, /\.best-banner/, 'best rank banner style should exist');
assert.match(style, /erase-mode/, 'erase mode style should exist');
assert.match(style, /\.card-rank/, 'card rank badge style should exist');

console.log('LUMEN_MIRROR 拡張スモークテスト: 完了 (全検証パス ✓)');
