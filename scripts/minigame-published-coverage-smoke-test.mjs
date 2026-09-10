import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const catalogPath = resolve(root, 'minigames.html');
const runnerPath = resolve(root, 'scripts/run-minigame-tests.mjs');

const catalog = readFileSync(catalogPath, 'utf8');
const runner = readFileSync(runnerPath, 'utf8');

const cardPattern = /<div\s+class="game-card"[^>]*>[\s\S]*?<a\s+href="\/([a-z0-9-]+)\/"\s+class="image-link">/g;
const published = [...catalog.matchAll(cardPattern)].map((match) => match[1]);

assert.ok(published.length > 0, 'minigames.html must publish at least one .game-card');
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
