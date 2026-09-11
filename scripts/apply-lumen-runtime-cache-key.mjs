import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const indexPath = 'lumen-mirror/index.html';
const smokePath = 'scripts/lumen-mirror-smoke-test.mjs';

let html = readFileSync(indexPath, 'utf8');
let smoke = readFileSync(smokePath, 'utf8');

const oldTag = '<script src="script.js?v=20260526-editor-review-fix"></script>';
const newTag = '<script src="script.js?v=20260911-runtime-split"></script>';
assert.equal((html.match(/script\.js\?v=/g) || []).length, 1, 'expected exactly one runtime script tag');
assert.ok(html.includes(oldTag), 'old runtime cache key not found');
html = html.replace(oldTag, newTag);
assert.equal(html.includes(oldTag), false, 'old runtime cache key must be removed');
assert.ok(html.includes(newTag), 'new runtime cache key must be present');

const oldAssertion = `assert.match(html, /src="script\\.js\\?v=20260526-editor-review-fix"/, 'editor script should be cache-busted');`;
const newAssertion = `assert.match(html, /src="script\\.js\\?v=20260911-runtime-split"/, 'split runtime script should use a fresh cache key');\nassert.doesNotMatch(html, /script\\.js\\?v=20260526-editor-review-fix/, 'pre-split runtime cache key must not remain');`;
assert.ok(smoke.includes(oldAssertion), 'smoke cache-key assertion not found');
smoke = smoke.replace(oldAssertion, newAssertion);

writeFileSync(indexPath, html);
writeFileSync(smokePath, smoke);
console.log('LUMEN runtime cache key updated for the split asset graph.');
