import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'wall-jumper');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const js = readFileSync(resolve(root, 'game.js'), 'utf8');
const css = readFileSync(resolve(root, 'style.css'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(html.includes('id="hud"'), 'HUD container is missing from index.html');
assert(!html.includes('id="game-clear"'), 'Endless game should not keep a clear/result screen');
assert(!html.includes('GAME CLEAR'), 'Endless game should not show a clear label');
assert(html.includes('fonts.googleapis.com'), 'Arcade/Japanese web fonts should be loaded explicitly');

assert(js.includes('safeReadBestDistance'), 'Best distance reads must be storage-safe');
assert(js.includes('safeWriteBestDistance'), 'Best distance writes must be storage-safe');
assert(js.includes('wallKickLockFrames'), 'Wall kick horizontal impulse should not be cancelled immediately');
assert(js.includes('getDifficultyForDistance'), 'Endless level generation should have a difficulty curve');
assert(js.includes('createPlatformCandidate'), 'Level generation should use a constrained platform rule');
assert(!js.includes('GOAL_Y'), 'Endless game should not have a fixed goal height');
assert(!js.includes('hasReachedGoal'), 'Endless game should not track goal completion');
assert(!js.includes('gameState = \'clear\''), 'Endless game should not enter a clear state');
assert(!js.includes('gameClearScreen'), 'Endless game should not wire a clear screen');

assert(!css.includes('display: flex !important'), 'Pause button display must not override JS state');
assert(css.includes('#hud'), 'HUD should have explicit styling');
assert(css.includes('#run-flash'), 'Death/retry feedback should be visual, not a result screen');

console.log('wall-jumper smoke test passed');
