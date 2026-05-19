import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = resolve(root, 'girigiri-brake', 'script.js');
const script = readFileSync(scriptPath, 'utf8');

assert.doesNotThrow(() => new vm.Script(script), 'girigiri-brake/script.js must be valid JavaScript');

assert.match(
  script,
  /if \(playerFrontX > CONFIG\.CLIFF_X\) \{\s*this\.triggerGameOverFall\(\);/s,
  'fall detection should use the same player front edge as result scoring'
);

assert.match(script, /BASE_ACC:\s*950,/, 'base acceleration should be toned down for a less punishing speed curve');
assert.match(script, /BASE_FRIC:\s*1900,/, 'base braking friction should be stronger');
assert.match(script, /DANGER_DISTANCE_PX:\s*5000/, 'danger warning should start earlier than the old 30m zone');
assert.match(script, /fric:\s*0\.55/, 'rain should remain slippery but not overwhelmingly punishing');

assert.match(
  script,
  /if \(this\.state !== STATE\.START && this\.state !== STATE\.RESULT\) \{/,
  'animation loop should stop once the result screen is shown'
);

assert.doesNotMatch(
  script,
  /Object\.assign\(uiLayer\.style,\s*styles\)/,
  'UI layer should not be constrained to the canvas aspect ratio on tall mobile screens'
);

const rainEffectChecks = script.match(/this\.weather\.name\.includes\('RAIN'\)/g) ?? [];
assert.equal(rainEffectChecks.length, 1, 'weather effect drawing should not be duplicated');

assert.match(script, /safeLoadBestDistance\(\)/, 'best score loading should be wrapped for storage failures');
assert.match(script, /safeSaveBestDistance\(distanceMeter\)/, 'best score saving should be wrapped for storage failures');
