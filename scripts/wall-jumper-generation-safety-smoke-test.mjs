import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'wall-jumper/game.js'), 'utf8');

function readNumericConst(name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*;`));
  assert.ok(match, `wall-jumper/game.js must define numeric const ${name}`);
  return Number(match[1]);
}

const gravity = readNumericConst('GRAVITY');
const jumpForce = readNumericConst('JUMP_FORCE');
const moveSpeed = readNumericConst('MOVE_SPEED');
assert.ok(gravity > 0, 'GRAVITY must be positive');
assert.ok(jumpForce < 0, 'JUMP_FORCE must launch upward');
assert.ok(moveSpeed > 0, 'MOVE_SPEED must be positive');

function calculateSingleJumpRise() {
  let vy = jumpForce;
  let rise = 0;
  for (let frame = 0; frame < 1000; frame += 1) {
    vy += gravity;
    if (vy >= 0) return rise;
    rise += -vy;
  }
  throw new Error('single-jump rise calculation did not converge');
}

const singleJumpRise = calculateSingleJumpRise();
const conservativeDoubleJumpRise = singleJumpRise * 2;
assert.ok(singleJumpRise > 0, 'single-jump rise must be positive');

const start = source.indexOf('function rand(');
const end = source.indexOf('function createDeathParticles(');
assert.ok(start >= 0 && end > start, 'could not isolate Wall Jumper generation functions');
const generationSource = source.slice(start, end);

const sandbox = vm.createContext({ console });
new vm.Script(`
const canvas = { width: 390, height: 844 };
let platforms = [];
let spikes = [];
${generationSource}

function seededRandom(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

globalThis.generateSnapshot = (seed, targetY) => {
  Math.random = seededRandom(seed);
  platforms = [{ x: 0, y: canvas.height - 20, width: canvas.width, height: 20 }];
  spikes = [];
  generateLevel(targetY);
  const segments = platforms.slice(1).map((platform, index) => {
    const previous = platforms[index];
    const distanceAtY = Math.max(0, Math.floor((canvas.height - previous.y) / 50));
    return {
      previous: { ...previous },
      platform: { ...platform },
      difficulty: { ...getDifficultyForDistance(distanceAtY) },
    };
  });
  return {
    platforms: platforms.map((platform) => ({ ...platform })),
    spikes: spikes.map((spike) => ({ ...spike })),
    segments,
  };
};
`, { filename: 'wall-jumper-generation-audit.vm.js' }).runInContext(sandbox);

const seedCount = 1000;
const targetY = -12000;
let checkedSegments = 0;
let checkedSpikes = 0;
let maxObservedGap = 0;
let maxObservedEdgeGap = 0;

for (let seed = 1; seed <= seedCount; seed += 1) {
  const snapshot = sandbox.generateSnapshot(seed, targetY);
  assert.ok(snapshot.platforms.length > 20, `seed ${seed}: generated too few platforms`);

  for (const { previous, platform, difficulty } of snapshot.segments) {
    checkedSegments += 1;
    const verticalGap = previous.y - platform.y;
    const previousCenter = previous.x + previous.width / 2;
    const center = platform.x + platform.width / 2;
    const centerShift = Math.abs(center - previousCenter);
    const leftGap = previous.x - (platform.x + platform.width);
    const rightGap = platform.x - (previous.x + previous.width);
    const edgeGap = Math.max(0, leftGap, rightGap);

    maxObservedGap = Math.max(maxObservedGap, verticalGap);
    maxObservedEdgeGap = Math.max(maxObservedEdgeGap, edgeGap);

    assert.ok(
      verticalGap >= difficulty.minGap - 1e-9 && verticalGap <= difficulty.maxGap + 1e-9,
      `seed ${seed}: vertical gap ${verticalGap} escaped configured range ${difficulty.minGap}-${difficulty.maxGap}`
    );
    assert.ok(
      platform.width >= difficulty.minWidth - 1e-9 && platform.width <= difficulty.maxWidth + 1e-9,
      `seed ${seed}: platform width ${platform.width} escaped configured range ${difficulty.minWidth}-${difficulty.maxWidth}`
    );
    assert.ok(
      centerShift <= difficulty.maxShift + 1e-9,
      `seed ${seed}: center shift ${centerShift} exceeded maxShift ${difficulty.maxShift}`
    );
    assert.ok(platform.x >= 18 - 1e-9, `seed ${seed}: platform escaped left safety margin (${platform.x})`);
    assert.ok(
      platform.x + platform.width <= 390 - 18 + 1e-9,
      `seed ${seed}: platform escaped right safety margin (${platform.x + platform.width})`
    );
    assert.ok(
      verticalGap <= conservativeDoubleJumpRise + 1e-9,
      `seed ${seed}: vertical gap ${verticalGap} exceeds conservative double-jump rise ${conservativeDoubleJumpRise}`
    );

    // Horizontal generation currently leaves only a small edge-to-edge gap even at peak difficulty.
    // Ten normal movement frames is deliberately conservative compared with the available jump airtime.
    assert.ok(
      edgeGap <= moveSpeed * 10 + 1e-9,
      `seed ${seed}: horizontal edge gap ${edgeGap} exceeds conservative movement envelope ${moveSpeed * 10}`
    );
  }

  for (const spike of snapshot.spikes) {
    checkedSpikes += 1;
    assert.ok(spike.height >= 44 && spike.height <= 60, `seed ${seed}: spike height out of range (${spike.height})`);
    const candidates = snapshot.platforms.filter((platform) =>
      Math.abs(platform.y - (spike.y + spike.height) - 45) < 1e-7
    );
    assert.ok(candidates.length > 0, `seed ${seed}: spike has no associated platform candidate`);
    const matchesOppositeWallRule = candidates.some((platform) => {
      const platformIsRight = platform.x + platform.width / 2 > 390 / 2;
      const expectedX = platformIsRight ? 0 : 390 - 14;
      return spike.x === expectedX;
    });
    assert.ok(matchesOppositeWallRule, `seed ${seed}: spike must stay on the wall opposite its associated platform`);
  }
}

assert.ok(checkedSegments > 50_000, `expected broad platform coverage, got ${checkedSegments}`);
assert.ok(checkedSpikes > 1_000, `expected broad spike coverage, got ${checkedSpikes}`);

console.log(
  `wall-jumper generation safety passed (${seedCount} seeds, ${checkedSegments} gaps, ${checkedSpikes} spikes, ` +
  `single-rise=${singleJumpRise.toFixed(1)}, double-rise=${conservativeDoubleJumpRise.toFixed(1)}, ` +
  `max-gap=${maxObservedGap.toFixed(1)}, max-edge-gap=${maxObservedEdgeGap.toFixed(1)})`
);
