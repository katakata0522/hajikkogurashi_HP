import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const catalogPath = resolve(root, 'minigames.html');
const runnerPath = resolve(root, 'scripts/run-minigame-tests.mjs');

const catalog = readFileSync(catalogPath, 'utf8');
const runner = readFileSync(runnerPath, 'utf8');

function extractPublishedSlugs(markup) {
    const imageLinkPattern = /<a\b(?=[^>]*\bclass="[^"]*\bimage-link\b[^"]*")(?=[^>]*\bhref="\/([a-z0-9-]+)\/")[^>]*>/g;
    return [...markup.matchAll(imageLinkPattern)].map((match) => match[1]);
}

function countGameCards(markup) {
    return (markup.match(/\bclass="[^"]*\bgame-card\b[^"]*"/g) || []).length;
}

const parserFixture = '<div class="featured game-card"><a aria-label="fixture" class="image-link extra" data-kind="game" href="/fixture-game/">';
assert.deepEqual(extractPublishedSlugs(parserFixture), ['fixture-game'], 'published parser must ignore anchor attribute order and extra classes');
assert.equal(countGameCards(parserFixture), 1, 'game-card counter must support additional classes');

const published = extractPublishedSlugs(catalog);
const gameCardCount = countGameCards(catalog);

assert.ok(gameCardCount > 0, 'minigames.html must publish at least one .game-card');
assert.equal(
    published.length,
    gameCardCount,
    `every game-card must expose exactly one image-link game route (cards=${gameCardCount}, routes=${published.length})`
);
assert.equal(new Set(published).size, published.length, 'published minigame slugs must be unique');

for (const slug of published) {
    const gameIndex = `${slug}/index.html`;
    const smokeTest = `scripts/${slug}-smoke-test.mjs`;
    const browserTest = `scripts/${slug}-browser-test.mjs`;

    assert.ok(existsSync(resolve(root, gameIndex)), `${slug}: ${gameIndex} must exist`);
    assert.ok(existsSync(resolve(root, smokeTest)), `${slug}: ${smokeTest} must exist`);
    assert.ok(existsSync(resolve(root, browserTest)), `${slug}: ${browserTest} must exist`);
    assert.ok(runner.includes(`'${smokeTest}'`), `${slug}: smoke test must be registered in run-minigame-tests.mjs`);
    assert.ok(runner.includes(`'${browserTest}'`), `${slug}: browser test must be registered in run-minigame-tests.mjs`);
}

console.log(`published minigame coverage passed (${published.length} games: ${published.join(', ')})`);
