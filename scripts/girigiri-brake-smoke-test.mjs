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
assert.match(script, /dist < 1\.0[\s\S]*神回避！！🔥/, 'top rank should keep the memorable 神回避 label');
assert.match(script, /dist < 3\.0[\s\S]*崖際マスター/, 'near-perfect rank should feel more special than a generic driver label');
assert.match(script, /percent < 5[\s\S]*ブレーキ職人/, 'upper rank should reward strong stops with a distinct label');
assert.match(script, /percent < 12[\s\S]*攻めの一踏み/, 'rank table should add a positive attacking mid-tier result');
assert.match(script, /percent < 25[\s\S]*勝負勘ドライバー/, 'common good results should stay positive');
assert.match(script, /percent < 40[\s\S]*余裕残しの完走/, 'safe clears should avoid negative wording');
assert.match(script, /percent < 60[\s\S]*堅実ブレーキ/, 'cautious clears should remain neutral before the negative tier');
assert.match(script, /percent < 80[\s\S]*ビビリ運転手/, 'negative rank wording should start much later than before');

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

assert.match(
  script,
  /playSkidStart\(weather\)/,
  'skid sound should accept weather so rain can sound slippery'
);

assert.match(
  script,
  /isRain\s*=\s*weather\?\.name\.includes\('RAIN'\)/,
  'skid sound should detect rain weather'
);

assert.match(
  script,
  /fallAngle/,
  'fall animation should rotate the car instead of sliding flat'
);

assert.doesNotMatch(
  script,
  /text:\s*'あと 10m'/,
  'late 10m sign should be removed to avoid visual noise near DANGER'
);
