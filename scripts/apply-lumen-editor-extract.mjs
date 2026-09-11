import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const indexPath = 'lumen-mirror/index.html';
const runtimePath = 'lumen-mirror/script.js';
const editorPath = 'lumen-mirror/editor.js';
const smokePath = 'scripts/lumen-mirror-smoke-test.mjs';

let html = readFileSync(indexPath, 'utf8');
let runtime = readFileSync(runtimePath, 'utf8');
let smoke = readFileSync(smokePath, 'utf8');

assert.equal(existsSync(editorPath), false, 'editor.js must not already exist');

const editorMarker = `    // ============================================================\n    // STAGE EDITOR (CREATIVE MODE) METHODS\n    // ============================================================\n`;
const classCloseMarker = `\n}\n\n// ============================================================\n// INIT\n// ============================================================`;
const editorStart = runtime.indexOf(editorMarker);
const classClose = runtime.indexOf(classCloseMarker, editorStart);
assert.ok(editorStart > 0, 'editor method marker missing');
assert.ok(classClose > editorStart, 'GameController closing marker missing after editor methods');
assert.equal(runtime.indexOf(editorMarker, editorStart + editorMarker.length), -1, 'editor marker must be unique');

const editorMethods = runtime.slice(editorStart, classClose).trimEnd() + '\n';
assert.ok(editorMethods.length > 30000, `editor extraction unexpectedly small: ${editorMethods.length}`);
assert.match(editorMethods, /_sanitizeStageTitle\(title\)/, 'editor block must include stage title sanitation');
assert.match(editorMethods, /initEditorEvents\(\)/, 'editor block must include event bindings');
assert.match(editorMethods, /serializeStage\(\)/, 'editor block must include serialization');
assert.match(editorMethods, /normalizeCustomStageData\(data\)/, 'editor block must include schema validation');
assert.match(editorMethods, /drawEditorSelection\(\)/, 'editor block must include editor drawing');
assert.doesNotMatch(editorMethods, /\n\s*constructor\s*\(/, 'editor extension must not define a constructor');
assert.doesNotMatch(editorMethods, /\bsuper\s*\./, 'editor methods must not depend on class super semantics');

runtime = runtime.slice(0, editorStart).trimEnd() + runtime.slice(classClose);
assert.doesNotMatch(runtime, /STAGE EDITOR \(CREATIVE MODE\) METHODS/, 'editor block must leave script.js');
assert.doesNotMatch(runtime, /\n\s{4}_sanitizeStageTitle\(title\)\s*\{/, 'editor methods must leave GameController body');
assert.match(runtime, /window\.addEventListener\('DOMContentLoaded', \(\) => \{ new GameController\(\); \}\);/, 'GameController initialization must remain unchanged');
assert.match(runtime, /this\.initEditorEvents\(\);/, 'constructor should keep the existing editor extension hook');

const editor = `/* LUMEN_MIRROR Stage Editor extension. Loaded after GameController and before DOMContentLoaded. */\nclass LumenEditorMethods {\n${editorMethods}}\n\nfor (const methodName of Object.getOwnPropertyNames(LumenEditorMethods.prototype)) {\n    if (methodName === 'constructor') continue;\n    if (Object.prototype.hasOwnProperty.call(GameController.prototype, methodName)) {\n        throw new Error(\`LUMEN editor method collision: \${methodName}\`);\n    }\n    Object.defineProperty(\n        GameController.prototype,\n        methodName,\n        Object.getOwnPropertyDescriptor(LumenEditorMethods.prototype, methodName)\n    );\n}\n`;

const oldRuntimeTag = '    <script src="script.js?v=20260911-runtime-split"></script>';
const newRuntimeTags = '    <script src="script.js?v=20260911-editor-split"></script>\n    <script src="editor.js?v=20260911-editor-split"></script>';
assert.ok(html.includes(oldRuntimeTag), 'current runtime script tag missing');
assert.equal(html.includes('editor.js'), false, 'editor.js tag already present');
html = html.replace(oldRuntimeTag, newRuntimeTags);
assert.equal(html.includes('script.js?v=20260911-runtime-split'), false, 'pre-editor-split runtime cache key must be removed');

const oldReadBlock = `const stages = readFileSync(resolve(root, 'lumen-mirror', 'stages.js'), 'utf8');\nconst runtime = readFileSync(resolve(root, 'lumen-mirror', 'script.js'), 'utf8');\nconst script = \`\${core}\\n\${runtime}\`;`;
const newReadBlock = `const stages = readFileSync(resolve(root, 'lumen-mirror', 'stages.js'), 'utf8');\nconst runtime = readFileSync(resolve(root, 'lumen-mirror', 'script.js'), 'utf8');\nconst editor = readFileSync(resolve(root, 'lumen-mirror', 'editor.js'), 'utf8');\nconst script = \`\${core}\\n\${runtime}\\n\${editor}\`;`;
assert.ok(smoke.includes(oldReadBlock), 'smoke source-read block missing');
smoke = smoke.replace(oldReadBlock, newReadBlock);

const oldRuntimeAssertions = `assert.match(html, /src="script\\.js\\?v=20260911-runtime-split"/, 'split runtime script should use a fresh cache key');\nassert.doesNotMatch(html, /script\\.js\\?v=20260526-editor-review-fix/, 'pre-split runtime cache key must not remain');`;
const newRuntimeAssertions = `assert.match(html, /src="script\\.js\\?v=20260911-editor-split"/, 'GameController runtime should use the editor-split cache key');\nassert.match(html, /src="editor\\.js\\?v=20260911-editor-split"/, 'Stage Editor extension should be loaded explicitly');\nassert.doesNotMatch(html, /script\\.js\\?v=(?:20260526-editor-review-fix|20260911-runtime-split)/, 'pre-editor-split runtime cache keys must not remain');`;
assert.ok(smoke.includes(oldRuntimeAssertions), 'smoke runtime cache assertions missing');
smoke = smoke.replace(oldRuntimeAssertions, newRuntimeAssertions);

const oldIndexes = `const runtimeIndex = html.indexOf('src="script.js');\nassert.ok(storageIndex >= 0 && coreIndex > storageIndex && stagesIndex > coreIndex && runtimeIndex > stagesIndex, 'storage guard, core, stages, and main runtime must load in dependency order');`;
const newIndexes = `const runtimeIndex = html.indexOf('src="script.js');\nconst editorIndex = html.indexOf('src="editor.js');\nassert.ok(storageIndex >= 0 && coreIndex > storageIndex && stagesIndex > coreIndex && runtimeIndex > stagesIndex && editorIndex > runtimeIndex, 'storage guard, core, stages, GameController, and editor extension must load in dependency order');`;
assert.ok(smoke.includes(oldIndexes), 'smoke load-order assertion missing');
smoke = smoke.replace(oldIndexes, newIndexes);

const oldSyntax = `assert.doesNotThrow(() => new vm.Script(runtime), 'script.js must be valid JS');`;
const newSyntax = `assert.doesNotThrow(() => new vm.Script(runtime), 'script.js must be valid JS');\nassert.doesNotThrow(() => new vm.Script(editor), 'editor.js must be valid JS');`;
assert.ok(smoke.includes(oldSyntax), 'smoke runtime syntax assertion missing');
smoke = smoke.replace(oldSyntax, newSyntax);

const gameBoundary = `assert.doesNotMatch(core, /class\\s+GameController/, 'GameController should not drift into core.js');`;
const editorBoundary = `${gameBoundary}\nassert.match(editor, /class\\s+LumenEditorMethods/, 'Stage Editor methods should live in editor.js');\nassert.match(editor, /Object\\.defineProperty\\(\\s*GameController\\.prototype/, 'editor extension should attach method descriptors to GameController');\nassert.match(editor, /_sanitizeStageTitle\\(title\\)/, 'editor extension should own stage title sanitation');\nassert.match(editor, /initEditorEvents\\(\\)/, 'editor extension should own editor event bindings');\nassert.match(editor, /serializeStage\\(\\)/, 'editor extension should own stage serialization');\nassert.match(editor, /normalizeCustomStageData\\(data\\)/, 'editor extension should own stage schema normalization');\nassert.doesNotMatch(runtime, /STAGE EDITOR \\(CREATIVE MODE\\) METHODS/, 'editor method block should not drift back into script.js');\nassert.doesNotMatch(runtime, /\\n\\s{4}_sanitizeStageTitle\\(title\\)\\s*\\{/, 'editor method definitions should not drift back into GameController');\nassert.match(runtime, /this\\.initEditorEvents\\(\\);/, 'GameController constructor should retain the extension hook');\nassert.match(runtime, /new GameController\\(\\)/, 'runtime should keep the existing GameController instance identity');`;
assert.ok(smoke.includes(gameBoundary), 'smoke GameController boundary marker missing');
smoke = smoke.replace(gameBoundary, editorBoundary);

writeFileSync(indexPath, html);
writeFileSync(runtimePath, runtime);
writeFileSync(editorPath, editor);
writeFileSync(smokePath, smoke);

console.log(`LUMEN editor extracted: ${editorMethods.length} chars moved out of script.js; runtime now ${runtime.length} chars`);
