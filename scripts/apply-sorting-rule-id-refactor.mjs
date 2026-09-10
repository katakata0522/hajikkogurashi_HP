import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const scriptPath = 'sorting-factory/script.js';
const smokePath = 'scripts/sorting-factory-smoke-test.mjs';
const browserPath = 'scripts/sorting-factory-browser-test.mjs';

let script = readFileSync(scriptPath, 'utf8');
let smoke = readFileSync(smokePath, 'utf8');
let browser = readFileSync(browserPath, 'utf8');

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  assert.ok(first >= 0, `${label}: expected source not found`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${label}: expected source must be unique`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

script = replaceOnce(
  script,
  "    RULES: { COLOR: '色', SHAPE: '形', SIZE: '大きさ', NUMBER: '数字' }",
  "    RULES: { COLOR: 'color', SHAPE: 'shape', SIZE: 'size', NUMBER: 'number' },\n    RULE_LABELS: { color: '色', shape: '形', size: '大きさ', number: '数字' }",
  'rule IDs and labels'
);

script = replaceOnce(
  script,
  `    setRule(ruleName) {
        if (!this.currentRuleText || !this.ruleDisplay) return;
        this.currentRuleText.innerText = ruleName;`,
  `    setRule(ruleId) {
        if (!this.currentRuleText || !this.ruleDisplay) return;
        const ruleLabel = CONFIG.RULE_LABELS[ruleId] ?? ruleId;
        this.currentRuleText.innerText = ruleLabel;`,
  'rule display label mapping'
);

script = replaceOnce(
  script,
  `    showRuleAlert(ruleName) {
        if (!this.alertText || !this.ruleAlert) return;
        this.alertText.innerText = ruleName;`,
  `    showRuleAlert(ruleId) {
        if (!this.alertText || !this.ruleAlert) return;
        const ruleLabel = CONFIG.RULE_LABELS[ruleId] ?? ruleId;
        this.alertText.innerText = ruleLabel;`,
  'rule alert label mapping'
);

script = replaceOnce(
  script,
  "            this.floatingTexts.push(new FloatingText(CONFIG.LOGICAL_WIDTH / 2, 400, `RULE: ${newRule}`, '#ff3366', 1.8));",
  "            this.floatingTexts.push(new FloatingText(CONFIG.LOGICAL_WIDTH / 2, 400, `RULE: ${CONFIG.RULE_LABELS[newRule] ?? newRule}`, '#ff3366', 1.8));",
  'floating rule label'
);

assert.ok(script.includes("RULES: { COLOR: 'color', SHAPE: 'shape', SIZE: 'size', NUMBER: 'number' }"));
assert.ok(script.includes("RULE_LABELS: { color: '色', shape: '形', size: '大きさ', number: '数字' }"));
assert.equal(script.includes("RULES: { COLOR: '色'"), false, 'display strings must not remain internal rule IDs');

const smokeAppend = `

assert.match(
  script,
  /RULES:\\s*\\{\\s*COLOR:\\s*'color',\\s*SHAPE:\\s*'shape',\\s*SIZE:\\s*'size',\\s*NUMBER:\\s*'number'\\s*\\}/,
  'rule logic should use stable language-neutral IDs'
);
assert.match(
  script,
  /RULE_LABELS:\\s*\\{\\s*color:\\s*'色',\\s*shape:\\s*'形',\\s*size:\\s*'大きさ',\\s*number:\\s*'数字'\\s*\\}/,
  'Japanese display labels should be separate from rule IDs'
);
assert.match(
  script,
  /const ruleLabel = CONFIG\\.RULE_LABELS\\[ruleId\\] \\?\\? ruleId;/,
  'UI should translate rule IDs only at the display boundary'
);
assert.doesNotMatch(
  script,
  /RULES:\\s*\\{[^}]*COLOR:\\s*'色'/,
  'display wording must not be used as game-logic identity'
);
`;
assert.equal(smoke.includes('rule logic should use stable language-neutral IDs'), false, 'rule ID smoke assertions already present');
smoke += smokeAppend;

const browserMarker = `  await page.tap('#start-btn');
  await page.waitForFunction(() => !document.querySelector('#score-hud').classList.contains('hidden'));
  await page.waitForTimeout(1700);`;
const browserReplacement = `  await page.tap('#start-btn');
  await page.waitForFunction(() => !document.querySelector('#score-hud').classList.contains('hidden'));
  const initialRuleLabel = (await page.locator('#current-rule-text').textContent())?.trim();
  if (initialRuleLabel !== '色') {
    throw new Error(\`initial rule label changed after ID separation: \${initialRuleLabel}\`);
  }
  await page.waitForTimeout(1700);`;
assert.ok(browser.includes(browserMarker), 'sorting browser insertion marker missing');
browser = browser.replace(browserMarker, browserReplacement);

writeFileSync(scriptPath, script);
writeFileSync(smokePath, smoke);
writeFileSync(browserPath, browser);

console.log('Sorting Factory rule IDs separated from Japanese labels.');
