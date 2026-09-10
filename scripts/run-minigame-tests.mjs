import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const mode = process.argv[2] || 'all';

const smokeTests = [
    'scripts/blackhole-sweeper-smoke-test.mjs',
    'scripts/girigiri-brake-smoke-test.mjs',
    'scripts/kage-mane-dojo-smoke-test.mjs',
    'scripts/kanji-slicer-smoke-test.mjs',
    'scripts/lumen-mirror-smoke-test.mjs',
    'scripts/mikiri-issen-smoke-test.mjs',
    'scripts/sorting-factory-smoke-test.mjs',
    'scripts/stealth-slacker-smoke-test.mjs',
    'scripts/wall-jumper-smoke-test.mjs'
];

const browserTests = [
    'scripts/blackhole-sweeper-browser-test.mjs',
    'scripts/kage-mane-dojo-browser-test.mjs',
    'scripts/kanji-slicer-browser-test.mjs',
    'scripts/lumen-mirror-browser-test.mjs',
    'scripts/lumen-storage-browser-test.mjs',
    'scripts/sorting-factory-browser-test.mjs',
    'scripts/stealth-slacker-browser-test.mjs',
    'scripts/wall-jumper-browser-test.mjs'
];

let selectedTests;
if (mode === 'smoke') selectedTests = smokeTests;
else if (mode === 'browser') selectedTests = browserTests;
else if (mode === 'all') selectedTests = [...smokeTests, ...browserTests];
else {
    console.error(`Unknown test mode: ${mode}. Use smoke, browser, or all.`);
    process.exit(2);
}

let failed = false;
for (const relativePath of selectedTests) {
    const absolutePath = resolve(root, relativePath);
    if (!existsSync(absolutePath)) {
        console.error(`\n[missing] ${relativePath}`);
        failed = true;
        continue;
    }

    console.log(`\n=== ${relativePath} ===`);
    const result = spawnSync(process.execPath, [absolutePath], {
        cwd: root,
        env: process.env,
        stdio: 'inherit'
    });

    if (result.error) {
        console.error(`[error] ${relativePath}: ${result.error.message}`);
        failed = true;
    } else if (result.status !== 0) {
        console.error(`[failed] ${relativePath}: exit ${result.status}`);
        failed = true;
    }
}

if (failed) {
    process.exit(1);
}

console.log(`\nAll ${mode} minigame tests passed (${selectedTests.length} files).`);
