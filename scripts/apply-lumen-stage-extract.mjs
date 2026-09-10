import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const indexPath = 'lumen-mirror/index.html';
const scriptPath = 'lumen-mirror/script.js';
const stagesPath = 'lumen-mirror/stages.js';
const smokePath = 'scripts/lumen-mirror-smoke-test.mjs';

let html = readFileSync(indexPath, 'utf8');
let script = readFileSync(scriptPath, 'utf8');
let smoke = readFileSync(smokePath, 'utf8');

assert.equal(existsSync(stagesPath), false, 'stages.js must not already exist');

const stageMarker = `// ============================================================\n// STAGE DATABASE (Serialized templates for easy expansion)\n// ============================================================\nconst STAGE_TEMPLATES = [`;
const controllerMarker = `// ============================================================\n// MAIN GAME CONTROLLER\n// ============================================================`;
const stageStart = script.indexOf(stageMarker);
const controllerStart = script.indexOf(controllerMarker);
assert.ok(stageStart >= 0, 'stage database marker missing');
assert.ok(controllerStart > stageStart, 'main controller marker must follow stage database');

const stageSource = script.slice(stageStart, controllerStart).trimEnd() + '\n';
assert.ok(stageSource.includes('const STAGE_TEMPLATES = ['), 'stage source must define STAGE_TEMPLATES');
assert.ok(stageSource.length > 10000, `stage data extraction unexpectedly small: ${stageSource.length}`);
assert.ok((stageSource.match(/\bid:\s*\d+/g) || []).length >= 7, 'stage data must retain at least seven stages');

script = script.slice(0, stageStart) + '// Stage templates are loaded from stages.js before the main runtime.\n\n' + script.slice(controllerStart);
assert.equal(script.includes('const STAGE_TEMPLATES = ['), false, 'stage definition must leave script.js');
assert.ok(script.includes('STAGE_TEMPLATES'), 'runtime must still consume STAGE_TEMPLATES');

const runtimeTag = '    <script src="script.js?v=20260526-editor-review-fix"></script>';
const stagedTags = '    <script src="stages.js?v=20260911-stage-data"></script>\n' + runtimeTag;
assert.ok(html.includes(runtimeTag), 'runtime script tag missing');
assert.equal(html.includes('stages.js'), false, 'stages.js tag already present');
html = html.replace(runtimeTag, stagedTags);

const oldReads = `const html = readFileSync(resolve(root, 'lumen-mirror', 'index.html'), 'utf8');\nconst script = readFileSync(resolve(root, 'lumen-mirror', 'script.js'), 'utf8');\nconst style = readFileSync(resolve(root, 'lumen-mirror', 'style.css'), 'utf8');`;
const newReads = `const html = readFileSync(resolve(root, 'lumen-mirror', 'index.html'), 'utf8');\nconst stages = readFileSync(resolve(root, 'lumen-mirror', 'stages.js'), 'utf8');\nconst script = readFileSync(resolve(root, 'lumen-mirror', 'script.js'), 'utf8');\nconst style = readFileSync(resolve(root, 'lumen-mirror', 'style.css'), 'utf8');`;
assert.ok(smoke.includes(oldReads), 'smoke read block missing');
smoke = smoke.replace(oldReads, newReads);

smoke = smoke.replace(
  "assert.match(html, /src=\"script\\.js\\?v=20260526-editor-review-fix\"/, 'editor script should be cache-busted');",
  `assert.match(html, /src="stages\\.js\\?v=20260911-stage-data"/, 'stage data should be loaded explicitly');\nassert.match(html, /src="script\\.js\\?v=20260526-editor-review-fix"/, 'editor script should be cache-busted');\nconst stagesIndex = html.indexOf('src="stages.js');\nconst runtimeIndex = html.indexOf('src="script.js');\nassert.ok(stagesIndex >= 0 && runtimeIndex > stagesIndex, 'stage data must load before the main runtime');`
);

smoke = smoke.replace(
  "assert.doesNotThrow(() => new vm.Script(script), 'script must be valid JS');",
  `assert.doesNotThrow(() => new vm.Script(stages), 'stages.js must be valid JS');\nassert.doesNotThrow(() => new vm.Script(script), 'script must be valid JS');`
);

smoke = smoke.replace(
  "assert.match(script, /STAGE_TEMPLATES/, 'Stage database should be defined');",
  `assert.match(stages, /const\\s+STAGE_TEMPLATES\\s*=\\s*\\[/, 'Stage database should be defined in stages.js');\nassert.doesNotMatch(script, /const\\s+STAGE_TEMPLATES\\s*=\\s*\\[/, 'Stage database should not drift back into script.js');\nassert.match(script, /STAGE_TEMPLATES/, 'Main runtime should consume the external stage database');`
);

smoke = smoke.replace(
  "const stageMatches = (script.match(/id:\\s*\\d+/g) || []).length;",
  "const stageMatches = (stages.match(/id:\\s*\\d+/g) || []).length;"
);

assert.ok(smoke.includes("readFileSync(resolve(root, 'lumen-mirror', 'stages.js')"), 'smoke must read stages.js');
assert.ok(smoke.includes('stage data must load before the main runtime'), 'smoke must guard load order');

writeFileSync(indexPath, html);
writeFileSync(stagesPath, stageSource);
writeFileSync(scriptPath, script);
writeFileSync(smokePath, smoke);

console.log(`LUMEN stage data extracted: ${stageSource.length} chars moved out of script.js`);
