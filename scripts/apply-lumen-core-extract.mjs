import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const indexPath = 'lumen-mirror/index.html';
const corePath = 'lumen-mirror/core.js';
const runtimePath = 'lumen-mirror/script.js';
const smokePath = 'scripts/lumen-mirror-smoke-test.mjs';

let html = readFileSync(indexPath, 'utf8');
let runtime = readFileSync(runtimePath, 'utf8');
let smoke = readFileSync(smokePath, 'utf8');

assert.equal(existsSync(corePath), false, 'core.js must not already exist');

const boundaryMarker = '// Stage templates are loaded from stages.js before the main runtime.';
const boundary = runtime.indexOf(boundaryMarker);
assert.ok(boundary > 0, 'core/runtime boundary marker missing');

const core = runtime.slice(0, boundary).trimEnd() + '\n';
runtime = runtime.slice(boundary);

assert.ok(core.length > 25000, `core extraction unexpectedly small: ${core.length}`);
assert.match(core, /const\s+CONFIG\s*=\s*\{/, 'core must retain CONFIG');
assert.match(core, /const\s+STATE\s*=\s*\{/, 'core must retain STATE');
assert.match(core, /class\s+ScoreManager/, 'core must retain ScoreManager');
assert.match(core, /class\s+AudioManager/, 'core must retain AudioManager');
assert.match(core, /class\s+Mirror/, 'core must retain Mirror');
assert.match(core, /class\s+Emitter/, 'core must retain Emitter');
assert.match(core, /class\s+Prism/, 'core must retain Prism');
assert.match(core, /class\s+BlackHole/, 'core must retain BlackHole');
assert.match(core, /class\s+Wormhole/, 'core must retain Wormhole');
assert.match(core, /class\s+ParticleSystem/, 'core must retain ParticleSystem');
assert.doesNotMatch(core, /class\s+GameController/, 'GameController must stay in script.js');
assert.match(runtime, /class\s+GameController/, 'runtime must retain GameController');
assert.doesNotMatch(runtime, /class\s+(?:ScoreManager|AudioManager|Mirror|Emitter|Prism|BlackHole|Wormhole|ParticleSystem)\b/, 'core classes must leave script.js');

const stagesTag = '    <script src="stages.js?v=20260911-stage-data"></script>';
const coreAndStages = '    <script src="core.js?v=20260911-core-split"></script>\n' + stagesTag;
assert.ok(html.includes(stagesTag), 'stages.js tag missing');
assert.equal(html.includes('core.js'), false, 'core.js tag already present');
html = html.replace(stagesTag, coreAndStages);

const oldReads = `const html = readFileSync(resolve(root, 'lumen-mirror', 'index.html'), 'utf8');\nconst stages = readFileSync(resolve(root, 'lumen-mirror', 'stages.js'), 'utf8');\nconst script = readFileSync(resolve(root, 'lumen-mirror', 'script.js'), 'utf8');\nconst style = readFileSync(resolve(root, 'lumen-mirror', 'style.css'), 'utf8');`;
const newReads = `const html = readFileSync(resolve(root, 'lumen-mirror', 'index.html'), 'utf8');\nconst core = readFileSync(resolve(root, 'lumen-mirror', 'core.js'), 'utf8');\nconst stages = readFileSync(resolve(root, 'lumen-mirror', 'stages.js'), 'utf8');\nconst runtime = readFileSync(resolve(root, 'lumen-mirror', 'script.js'), 'utf8');\nconst script = \`\${core}\\n\${runtime}\`;\nconst style = readFileSync(resolve(root, 'lumen-mirror', 'style.css'), 'utf8');`;
assert.ok(smoke.includes(oldReads), 'smoke source-read block missing');
smoke = smoke.replace(oldReads, newReads);

const oldLoadOrder = `assert.match(html, /src="stages\\.js\\?v=20260911-stage-data"/, 'stage data should be loaded explicitly');\nassert.match(html, /src="script\\.js\\?v=20260526-editor-review-fix"/, 'editor script should be cache-busted');\nconst stagesIndex = html.indexOf('src="stages.js');\nconst runtimeIndex = html.indexOf('src="script.js');\nassert.ok(stagesIndex >= 0 && runtimeIndex > stagesIndex, 'stage data must load before the main runtime');`;
const newLoadOrder = `assert.match(html, /src="core\\.js\\?v=20260911-core-split"/, 'core runtime dependencies should be loaded explicitly');\nassert.match(html, /src="stages\\.js\\?v=20260911-stage-data"/, 'stage data should be loaded explicitly');\nassert.match(html, /src="script\\.js\\?v=20260526-editor-review-fix"/, 'editor script should be cache-busted');\nconst storageIndex = html.indexOf('src="/assets/js/minigame-storage-guard.js');\nconst coreIndex = html.indexOf('src="core.js');\nconst stagesIndex = html.indexOf('src="stages.js');\nconst runtimeIndex = html.indexOf('src="script.js');\nassert.ok(storageIndex >= 0 && coreIndex > storageIndex && stagesIndex > coreIndex && runtimeIndex > stagesIndex, 'storage guard, core, stages, and main runtime must load in dependency order');`;
assert.ok(smoke.includes(oldLoadOrder), 'smoke load-order block missing');
smoke = smoke.replace(oldLoadOrder, newLoadOrder);

const oldSyntax = `assert.doesNotThrow(() => new vm.Script(stages), 'stages.js must be valid JS');\nassert.doesNotThrow(() => new vm.Script(script), 'script must be valid JS');`;
const newSyntax = `assert.doesNotThrow(() => new vm.Script(core), 'core.js must be valid JS');\nassert.doesNotThrow(() => new vm.Script(stages), 'stages.js must be valid JS');\nassert.doesNotThrow(() => new vm.Script(runtime), 'script.js must be valid JS');`;
assert.ok(smoke.includes(oldSyntax), 'smoke syntax block missing');
smoke = smoke.replace(oldSyntax, newSyntax);

const gameControllerAssertion = "assert.match(script, /class\\s+GameController/, 'GameController should be implemented');";
const boundaryAssertions = `${gameControllerAssertion}\nassert.match(core, /class\\s+AudioManager/, 'AudioManager should live in core.js');\nassert.match(core, /class\\s+ScoreManager/, 'ScoreManager should live in core.js');\nassert.match(core, /class\\s+Mirror/, 'Mirror should live in core.js');\nassert.match(runtime, /class\\s+GameController/, 'GameController should stay in script.js');\nassert.doesNotMatch(runtime, /class\\s+(?:ScoreManager|AudioManager|Mirror|Emitter|Prism|BlackHole|Wormhole|ParticleSystem)\\b/, 'core classes should not drift back into script.js');\nassert.doesNotMatch(core, /class\\s+GameController/, 'GameController should not drift into core.js');`;
assert.ok(smoke.includes(gameControllerAssertion), 'GameController smoke assertion missing');
smoke = smoke.replace(gameControllerAssertion, boundaryAssertions);

writeFileSync(indexPath, html);
writeFileSync(corePath, core);
writeFileSync(runtimePath, runtime);
writeFileSync(smokePath, smoke);

console.log(`LUMEN core extracted: ${core.length} chars moved out of script.js; runtime now ${runtime.length} chars`);
