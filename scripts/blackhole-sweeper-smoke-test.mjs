import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'blackhole-sweeper', 'index.html'), 'utf8');
const script = readFileSync(resolve(root, 'blackhole-sweeper', 'script.js'), 'utf8');
const style = readFileSync(resolve(root, 'blackhole-sweeper', 'style.css'), 'utf8');

assert.match(html, /<button id="trophy-btn"/, 'achievement catalog button should be present');
assert.match(html, /<div id="achievements-modal"/, 'achievement catalog modal should be present');
assert.doesNotThrow(() => new vm.Script(script), 'blackhole-sweeper script must be valid JavaScript');

assert.match(
  script,
  /const\s+ACHIEVEMENTS\s*=\s*\[/,
  'achievement thresholds should be defined in script'
);

assert.match(script, /kind:\s*'combo'/, 'achievements should include combo-based goals');
assert.match(script, /kind:\s*'area'/, 'achievements should include area-based goals');
assert.match(script, /kind:\s*'noDamage'/, 'achievements should include no-damage goals');
assert.match(script, /function\s+readAchievementStats/, 'achievement stats should be persisted separately from best score');
assert.match(script, /function\s+mergeAchievementStats/, 'achievement stats should merge score and non-score elements');
assert.match(script, /function\s+hasSeenTutorial/, 'tutorial should be shown only until the first input is made');
assert.match(script, /markTutorialSeen\(\)/, 'first input should persist tutorial completion');

assert.match(
  script,
  /function\s+readBestScore\(\)\s*\{[\s\S]*?try\s*\{[\s\S]*?localStorage\.getItem\('blackhole_best_score'\)/,
  'best-score loading should be isolated behind a safe helper'
);

assert.match(
  script,
  /function\s+writeBestScore\(score\)\s*\{[\s\S]*?try\s*\{[\s\S]*?localStorage\.setItem\('blackhole_best_score',\s*String\(score\)\)/,
  'best-score saving should be isolated behind a safe helper'
);

assert.match(
  script,
  /getElementById\('trophy-btn'\)[\s\S]*?addEventListener\('click'/,
  'achievement catalog button should be wired'
);

assert.match(
  script,
  /getElementById\('close-modal-btn'\)[\s\S]*?addEventListener\('click'/,
  'achievement catalog close button should be wired'
);

assert.match(
  script,
  /this\.missEffects\s*=\s*\[\]/,
  'miss effects should be tracked for empty loops'
);

assert.match(
  script,
  /addMissEffect\(/,
  'empty loops should trigger a visual miss effect'
);

assert.match(script, /case\s+'miss'/, 'empty loops should have a light miss sound');
assert.match(html, /id="tutorial-overlay"/, 'a visual tutorial overlay should be present');
assert.match(html, /次:\s*初回吸引成功\s*\/\s*300pt/, 'initial next achievement label should match the low-score achievement');
assert.match(style, /\.tutorial-overlay/, 'tutorial overlay should be styled');
assert.match(style, /\.tutorial-loop/, 'tutorial should show a loop gesture');
assert.match(html, /id="next-achievement-text"/, 'result should show the next achievement target');
assert.match(script, /updateNextAchievement/, 'result should update the next achievement target');

assert.match(
  script,
  /this\.gameState\s*===\s*STATE\.GAMEOVER/,
  'double-tap restart should be limited to the result state'
);

assert.doesNotMatch(
  script,
  /this\.gameState\s*===\s*STATE\.GAMEOVER\s*\|\|\s*this\.gameState\s*===\s*STATE\.START/,
  'double-tap should not start from the start screen'
);

assert.match(
  script,
  /cy\s*\/=\s*loopPoints\.length/,
  'blackhole center should average both x and y coordinates'
);

assert.match(script, /navigator\.share/, 'sharing should use native Web Share when available');
assert.match(script, /navigator\.clipboard\.writeText/, 'sharing should fall back to clipboard');
assert.match(
  script,
  /window\.open\([^)]*'_blank',\s*'noopener,noreferrer'\)/,
  'external share fallback should open with noopener and noreferrer'
);

assert.match(style, /\.menu-buttons-vertical\s*\{[\s\S]*?display:\s*flex;/, 'start menu button stack should be styled');
assert.match(style, /\.modal\s*\{[\s\S]*?position:\s*absolute;/, 'achievement modal should be styled');
assert.match(style, /\.achievement-card\.unlocked/, 'unlocked achievement cards should be styled');
assert.match(style, /\.toast-container/, 'achievement/share toast should be styled');
