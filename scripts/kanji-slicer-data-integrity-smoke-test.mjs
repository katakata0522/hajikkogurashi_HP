import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'kanji-slicer/game.js'), 'utf8');

function extractConst(name, nextMarker) {
    const marker = `const ${name} = `;
    const start = source.indexOf(marker);
    assert.ok(start >= 0, `${name} definition must exist`);
    const valueStart = start + marker.length;
    const end = source.indexOf(nextMarker, valueStart);
    assert.ok(end > valueStart, `${name} definition terminator must exist`);
    const literal = source.slice(valueStart, end).trim().replace(/;$/, '');
    return vm.runInNewContext(`(${literal})`, Object.create(null), { filename: `extract-${name}.js` });
}

const KANJI_DATA = extractConst('KANJI_DATA', '\n\nconst TIER1_KANJI');
const TIER1_KANJI = extractConst('TIER1_KANJI', '\nconst TIER2_KANJI');
const TIER2_KANJI = extractConst('TIER2_KANJI', '\n\n// Idiom Recipes');
const IDIOM_RECIPES = extractConst('IDIOM_RECIPES', '\n\n// Merge Recipes');
const RECIPES = extractConst('RECIPES', '\n\n// Decomposition mappings');
const DECOMPOSITIONS = extractConst('DECOMPOSITIONS', '\n\n// Radii based on Tier');
const VALID_IDIOMS = extractConst('VALID_IDIOMS', '\ndiscoveredKanji =');

const kanjiNames = new Set(Object.keys(KANJI_DATA));
const baseNames = new Set(TIER1_KANJI);

assert.equal(baseNames.size, TIER1_KANJI.length, 'TIER1_KANJI must not contain duplicates');
assert.equal(new Set(TIER2_KANJI).size, TIER2_KANJI.length, 'TIER2_KANJI must not contain duplicates');
assert.equal(new Set(VALID_IDIOMS).size, VALID_IDIOMS.length, 'VALID_IDIOMS must not contain duplicates');

for (const name of TIER1_KANJI) {
    assert.ok(kanjiNames.has(name), `Tier 1 kanji ${name} must exist in KANJI_DATA`);
    assert.equal(KANJI_DATA[name].tier, 1, `Tier 1 kanji ${name} must declare tier 1`);
}
for (const name of TIER2_KANJI) {
    assert.ok(kanjiNames.has(name), `Tier 2 kanji ${name} must exist in KANJI_DATA`);
    assert.equal(KANJI_DATA[name].tier, 2, `Tier 2 kanji ${name} must declare tier 2`);
}

function canonicalPair(a, b) {
    return [a, b].sort().join('\u0000');
}

const mergePairs = new Map();
for (const recipe of RECIPES) {
    for (const input of [recipe.a, recipe.b]) {
        assert.ok(kanjiNames.has(input), `Merge input ${input} must exist in KANJI_DATA`);
    }
    assert.ok(kanjiNames.has(recipe.result), `Merge result ${recipe.result} must exist in KANJI_DATA`);
    assert.equal(KANJI_DATA[recipe.result].tier, recipe.tier, `Merge result ${recipe.result} tier must match recipe tier`);

    const key = canonicalPair(recipe.a, recipe.b);
    const signature = `${recipe.result}:${recipe.tier}`;
    if (mergePairs.has(key)) {
        assert.equal(mergePairs.get(key), signature, `Merge pair ${recipe.a}+${recipe.b} must not have conflicting results`);
    } else {
        mergePairs.set(key, signature);
    }
}

const idiomPairs = new Map();
for (const recipe of IDIOM_RECIPES) {
    for (const input of [recipe.a, recipe.b]) {
        assert.ok(kanjiNames.has(input), `Idiom input ${input} must exist in KANJI_DATA`);
    }
    assert.ok(kanjiNames.has(recipe.result), `Idiom result ${recipe.result} must exist in KANJI_DATA`);
    assert.equal(KANJI_DATA[recipe.result].tier, 4, `Idiom result ${recipe.result} must declare tier 4`);

    const key = canonicalPair(recipe.a, recipe.b);
    if (idiomPairs.has(key)) {
        assert.equal(idiomPairs.get(key), recipe.result, `Idiom pair ${recipe.a}+${recipe.b} must not have conflicting results`);
    } else {
        idiomPairs.set(key, recipe.result);
    }
}

const idiomResults = new Set(IDIOM_RECIPES.map((recipe) => recipe.result));
assert.deepEqual(
    [...new Set(VALID_IDIOMS)].sort(),
    [...idiomResults].sort(),
    'VALID_IDIOMS must exactly match the set of IDIOM_RECIPES results'
);

for (const [result, parts] of Object.entries(DECOMPOSITIONS)) {
    assert.ok(kanjiNames.has(result), `Decomposition result ${result} must exist in KANJI_DATA`);
    assert.ok(Array.isArray(parts) && parts.length === 2, `${result} decomposition must have exactly two parts`);
    for (const input of parts) {
        assert.ok(kanjiNames.has(input), `Decomposition input ${input} must exist in KANJI_DATA`);
    }
    const key = canonicalPair(parts[0], parts[1]);
    const expected = `${result}:${KANJI_DATA[result].tier}`;
    assert.equal(mergePairs.get(key), expected, `Decomposition ${result} must correspond to a merge recipe`);
}

// Compute which non-idiom kanji are constructible starting only from Tier 1 drops.
const reachable = new Set(TIER1_KANJI);
let changed = true;
while (changed) {
    changed = false;
    for (const recipe of RECIPES) {
        if (reachable.has(recipe.a) && reachable.has(recipe.b) && !reachable.has(recipe.result)) {
            reachable.add(recipe.result);
            changed = true;
        }
    }
}

for (const recipe of IDIOM_RECIPES) {
    assert.ok(
        reachable.has(recipe.a) && reachable.has(recipe.b),
        `Idiom ${recipe.result} must be reachable from Tier 1 drops; missing path for ${recipe.a}+${recipe.b}`
    );
}

const uniqueMergePairs = mergePairs.size;
const uniqueIdiomPairs = idiomPairs.size;

assert.equal(uniqueMergePairs, RECIPES.length, 'Merge recipes must use one row per unordered pair');
assert.equal(uniqueIdiomPairs, IDIOM_RECIPES.length, 'Idiom recipes must use one row per unordered pair');
assert.ok(source.includes('const IDIOM_RECIPE_MAP = new Map('), 'Idiom collision lookup must use a precomputed Map');
assert.ok(source.includes('const MERGE_RECIPE_MAP = new Map('), 'Merge collision lookup must use a precomputed Map');
assert.ok(source.includes('const IDIOM_RECIPE_BY_RESULT = new Map();'), 'Representative idiom lookup must use a result Map');
assert.equal(/\bIDIOM_RECIPES\.find\s*\(/.test(source), false, 'Idiom lookup must not fall back to linear find');
assert.equal(/\bRECIPES\.find\s*\(/.test(source), false, 'Merge lookup must not fall back to linear find');
assert.ok(source.includes("safeStorage.setItem('kanjislicer_best', bestScore);"), 'Best score must use safeStorage');
assert.equal(source.includes("localStorage.setItem('kanjislicer_best', bestScore);"), false, 'Best score must not bypass safeStorage');

console.log(
    `kanji data integrity passed: ${Object.keys(KANJI_DATA).length} entries, ` +
    `${RECIPES.length} unique merge pairs, ` +
    `${IDIOM_RECIPES.length} unique idiom pairs, ` +
    `${VALID_IDIOMS.length} reachable missions`
);
