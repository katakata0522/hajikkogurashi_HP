import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'mikiri-issen', 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1] ?? '';

assert.ok(script, 'inline script should be present');
assert.doesNotThrow(() => new vm.Script(script), 'mikiri-issen inline script must be valid JavaScript');

assert.doesNotMatch(
  html,
  /<main class="shell" aria-live="polite">/,
  'the entire game shell should not be a live region'
);

assert.match(
  html,
  /id="stateLabel"[^>]*aria-live="polite"/,
  'only the state label should announce duel state changes'
);

assert.match(
  script,
  /if \(event\.repeat\) return;/,
  'keyboard repeat should not cause accidental early failures'
);

assert.match(
  script,
  /https:\/\/hajikkoroom\.xsrv\.jp\/mikiri-issen\//,
  'shared result text should include the public game URL'
);

assert.match(
  script,
  /confirm\('記録をリセットしますか？'\)/,
  'record reset should require confirmation'
);

assert.match(
  html,
  /class="versus-pill result-optional" id="enemyRankResultLabel"/,
  'secondary enemy details should stay out of the compact result card'
);

assert.match(
  html,
  /class="result-box result-optional"><span>TOTAL WINS<\/span>/,
  'secondary record details should stay out of the compact result card'
);

assert.match(
  html,
  /\.result-optional\s*\{\s*display:\s*none;\s*\}/,
  'optional result details should be visually hidden by default'
);

assert.match(
  html,
  /\.result-card\s*\{[\s\S]*?width:\s*min\(720px,\s*100%\);/,
  'desktop result card should use a compact width'
);
