import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'stealth-slacker', 'index.html'), 'utf8');
const script = readFileSync(resolve(root, 'stealth-slacker', 'script.js'), 'utf8');
const style = readFileSync(resolve(root, 'stealth-slacker', 'style.css'), 'utf8');

assert.match(html, /<canvas id="game-canvas"><\/canvas>/, 'game canvas should be present');
assert.doesNotThrow(() => new vm.Script(script), 'stealth-slacker script must be valid JavaScript');

assert.match(
  script,
  /function\s+readBestScore\(\)\s*\{[\s\S]*?try\s*\{[\s\S]*?localStorage\.getItem\('stealth_best_score'\)/,
  'best-score loading should be isolated behind a safe helper'
);

assert.match(
  script,
  /function\s+writeBestScore\(score\)\s*\{[\s\S]*?try\s*\{[\s\S]*?localStorage\.setItem\('stealth_best_score',\s*String\(score\)\)/,
  'best-score saving should be isolated behind a safe helper'
);

assert.doesNotMatch(
  script,
  /STATE\.RESULT/,
  'result-state checks should not reference a state that does not exist'
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
  /\.dark-mode-container\s*\{[\s\S]*?pointer-events:\s*auto;/,
  'dark mode toggle should be clickable above screen overlays'
);

assert.match(
  script,
  /finalScore\s*>\s*0[\s\S]*?writeBestScore\(finalScore\)/,
  'zero-point games should not be saved as a best score'
);

assert.match(script, /stressRate\s*=\s*16/, 'working stress should rise at the requested gentler rate');
assert.match(script, /MIN_WARNING_TIME:\s*400/, 'boss warnings should keep a human-reactable lower bound');
assert.match(script, /DOUBLE_TURN_WARNING_MIN:\s*500/, 'double-turn warnings should not be instant deaths');
assert.match(script, /DOUBLE_TURN_DELAY_MIN:\s*500/, 'double-turn follow-ups should leave a readable gap');
assert.match(
  script,
  /safeSlackingTimer\s*=\s*CONFIG\.SAFE_SLACK_AFTER_LOOK_MS/,
  'boss departure should grant a short safe slacking window'
);
assert.doesNotMatch(script, /currentWarningTime\s*=\s*200/, 'double-turn warning should not use the old 200ms trap');
assert.doesNotMatch(script, /bossTimer\s*=\s*150/, 'double-turn delay should not use the old 150ms trap');

assert.match(
  script,
  /showShareFeedback\(/,
  'clipboard sharing should show visible feedback'
);

assert.match(
  style,
  /\.comic-btn\.copied/,
  'share feedback should have a visible copied button state'
);

assert.match(
  style,
  /\.screen\s*\{[\s\S]*?touch-action:\s*pan-y;/,
  'screens should allow vertical scrolling instead of inheriting touch-action none'
);

assert.match(
  style,
  /\.comic-btn\s*\{[\s\S]*?touch-action:\s*manipulation;/,
  'buttons should allow normal tap behavior'
);
