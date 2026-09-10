import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const gamePath = 'kanji-slicer/game.js';
const integrityPath = 'scripts/kanji-slicer-data-integrity-smoke-test.mjs';
const browserPath = 'scripts/kanji-slicer-browser-test.mjs';

let game = readFileSync(gamePath, 'utf8');
let integrity = readFileSync(integrityPath, 'utf8');
let browser = readFileSync(browserPath, 'utf8');

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  assert.ok(first >= 0, `${label}: expected source not found`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${label}: expected source must be unique`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function canonicalPair(a, b) {
  return a <= b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function dedupeRecipeArray(source, name, hasTier, expectedRows, expectedUnique) {
  const startMarker = `const ${name} = [`;
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `${name}: start marker missing`);
  const end = source.indexOf('\n];', start);
  assert.ok(end > start, `${name}: end marker missing`);

  const block = source.slice(start, end + 3);
  const lines = block.split('\n');
  const seen = new Map();
  let rowCount = 0;
  let skipped = 0;

  const rowPattern = hasTier
    ? /^(\s*)\{ a: '([^']+)', b: '([^']+)', result: '([^']+)', tier: (\d+) \},?$/
    : /^(\s*)\{ a: '([^']+)', b: '([^']+)', result: '([^']+)' \},?$/;

  const output = [];
  for (const line of lines) {
    const match = line.match(rowPattern);
    if (!match) {
      output.push(line);
      continue;
    }

    rowCount += 1;
    const [, , a, b, result, tierRaw] = match;
    const key = canonicalPair(a, b);
    const signature = hasTier ? `${result}:${tierRaw}` : result;

    if (seen.has(key)) {
      assert.equal(seen.get(key), signature, `${name}: conflicting duplicate for ${a}+${b}`);
      skipped += 1;
      continue;
    }

    seen.set(key, signature);
    output.push(line);
  }

  assert.equal(rowCount, expectedRows, `${name}: source row count changed unexpectedly`);
  assert.equal(seen.size, expectedUnique, `${name}: unique pair count changed unexpectedly`);
  assert.equal(rowCount - skipped, expectedUnique, `${name}: duplicate removal count mismatch`);

  return source.slice(0, start) + output.join('\n') + source.slice(end + 3);
}

game = dedupeRecipeArray(game, 'IDIOM_RECIPES', false, 52, 26);
game = dedupeRecipeArray(game, 'RECIPES', true, 28, 16);

const mapMarker = '\n\n// Sketchy Zen-style brush circle (円相 Enso)';
const mapIndex = game.indexOf(mapMarker);
assert.ok(mapIndex >= 0, 'recipe map insertion marker missing');
assert.equal(game.includes('const IDIOM_RECIPE_MAP = new Map('), false, 'recipe maps already present');

const mapSource = `

// Canonical recipe indexes: collision order does not change the result.
function recipePairKey(a, b) {
    return a <= b ? \`\${a}\\u0000\${b}\` : \`\${b}\\u0000\${a}\`;
}

const IDIOM_RECIPE_MAP = new Map(
    IDIOM_RECIPES.map((recipe) => [recipePairKey(recipe.a, recipe.b), recipe])
);
const MERGE_RECIPE_MAP = new Map(
    RECIPES.map((recipe) => [recipePairKey(recipe.a, recipe.b), recipe])
);
const IDIOM_RECIPE_BY_RESULT = new Map();
for (const recipe of IDIOM_RECIPES) {
    if (!IDIOM_RECIPE_BY_RESULT.has(recipe.result)) {
        IDIOM_RECIPE_BY_RESULT.set(recipe.result, recipe);
    }
}`;

game = game.slice(0, mapIndex) + mapSource + game.slice(mapIndex);

game = replaceOnce(
  game,
  "    const recipe = IDIOM_RECIPES.find(r => r.result === currentMission);",
  "    const recipe = IDIOM_RECIPE_BY_RESULT.get(currentMission);",
  'mission representative recipe lookup'
);

game = replaceOnce(
  game,
  `    const idiomRecipe = IDIOM_RECIPES.find(r => \n        (r.a === c1.kanji && r.b === c2.kanji) || \n        (r.a === c2.kanji && r.b === c1.kanji)\n    );`,
  "    const idiomRecipe = IDIOM_RECIPE_MAP.get(recipePairKey(c1.kanji, c2.kanji));",
  'idiom collision lookup'
);

game = replaceOnce(
  game,
  `    const recipe = RECIPES.find(r => \n        (r.a === c1.kanji && r.b === c2.kanji) || \n        (r.a === c2.kanji && r.b === c1.kanji)\n    );`,
  "    const recipe = MERGE_RECIPE_MAP.get(recipePairKey(c1.kanji, c2.kanji));",
  'merge collision lookup'
);

game = replaceOnce(
  game,
  "    const recipe = IDIOM_RECIPES.find(r => r.result === kanji);",
  "    const recipe = IDIOM_RECIPE_BY_RESULT.get(kanji);",
  'dictionary representative recipe lookup'
);

game = replaceOnce(
  game,
  "        localStorage.setItem('kanjislicer_best', bestScore);",
  "        safeStorage.setItem('kanjislicer_best', bestScore);",
  'best-score safe storage'
);

assert.equal(/\bIDIOM_RECIPES\.find\s*\(/.test(game), false, 'IDIOM_RECIPES.find must be removed');
assert.equal(/\bRECIPES\.find\s*\(/.test(game), false, 'RECIPES.find must be removed');
assert.equal(game.includes("localStorage.setItem('kanjislicer_best', bestScore);"), false, 'direct best-score storage write must be removed');

const integrityTailStart = integrity.indexOf('const reversibleMergePairs =');
assert.ok(integrityTailStart >= 0, 'integrity test normalization tail marker missing');

integrity = integrity.slice(0, integrityTailStart) + `const uniqueMergePairs = mergePairs.size;
const uniqueIdiomPairs = idiomPairs.size;

assert.equal(uniqueMergePairs, RECIPES.length, 'Merge recipes must use one row per unordered pair');
assert.equal(uniqueIdiomPairs, IDIOM_RECIPES.length, 'Idiom recipes must use one row per unordered pair');
assert.ok(source.includes('const IDIOM_RECIPE_MAP = new Map('), 'Idiom collision lookup must use a precomputed Map');
assert.ok(source.includes('const MERGE_RECIPE_MAP = new Map('), 'Merge collision lookup must use a precomputed Map');
assert.ok(source.includes('const IDIOM_RECIPE_BY_RESULT = new Map();'), 'Representative idiom lookup must use a result Map');
assert.equal(/\\bIDIOM_RECIPES\\.find\\s*\\(/.test(source), false, 'Idiom lookup must not fall back to linear find');
assert.equal(/\\bRECIPES\\.find\\s*\\(/.test(source), false, 'Merge lookup must not fall back to linear find');
assert.ok(source.includes("safeStorage.setItem('kanjislicer_best', bestScore);"), 'Best score must use safeStorage');
assert.equal(source.includes("localStorage.setItem('kanjislicer_best', bestScore);"), false, 'Best score must not bypass safeStorage');

console.log(
    \`kanji data integrity passed: \${Object.keys(KANJI_DATA).length} entries, \` +
    \`\${RECIPES.length} unique merge pairs, \` +
    \`\${IDIOM_RECIPES.length} unique idiom pairs, \` +
    \`\${VALID_IDIOMS.length} reachable missions\`
);
`;

const browserTail = `  if (errors.length) throw new Error(\`kanji-slicer interaction errors: \${errors.join(' | ')}\`);\n\n  await page.close();\n  await browser.close();`;
assert.ok(browser.includes(browserTail), 'browser test insertion marker missing');

const blockedStorageCoverage = `  if (errors.length) throw new Error(\`kanji-slicer interaction errors: \${errors.join(' | ')}\`);

  const blockedPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const blockedErrors = [];
  blockedPage.on('pageerror', (error) => blockedErrors.push(error.message));
  await blockedPage.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear']) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() { throw new Error(\`blocked \${method}\`); },
      });
    }
  });

  await blockedPage.goto(\`http://127.0.0.1:\${port}/kanji-slicer/\`, { waitUntil: 'networkidle' });
  await blockedPage.waitForTimeout(150);
  const blockedResult = await blockedPage.evaluate(() => {
    let storageActuallyBlocked = false;
    try {
      localStorage.setItem('probe', '1');
    } catch (_) {
      storageActuallyBlocked = true;
    }
    const callable = typeof addScore === 'function';
    if (callable) addScore(10);
    return {
      storageActuallyBlocked,
      callable,
      score: document.querySelector('#score')?.textContent,
      best: document.querySelector('#best-score')?.textContent,
    };
  });

  if (!blockedResult.storageActuallyBlocked) throw new Error('blocked-storage fixture did not block localStorage');
  if (!blockedResult.callable) throw new Error('addScore must remain callable for regression coverage');
  if (blockedResult.score !== '10' || blockedResult.best !== '10') {
    throw new Error(\`blocked-storage best update failed: \${JSON.stringify(blockedResult)}\`);
  }
  if (blockedErrors.length) throw new Error(\`kanji-slicer blocked-storage errors: \${blockedErrors.join(' | ')}\`);

  await blockedPage.close();
  await page.close();
  await browser.close();`;

browser = browser.replace(browserTail, blockedStorageCoverage);

writeFileSync(gamePath, game);
writeFileSync(integrityPath, integrity);
writeFileSync(browserPath, browser);

console.log('Kanji recipe normalization prepared successfully.');
