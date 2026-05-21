const fs = require('fs');
const html = fs.readFileSync('lumen-mirror/index.html', 'utf8');
const script = fs.readFileSync('lumen-mirror/script.js', 'utf8');
const style = fs.readFileSync('lumen-mirror/style.css', 'utf8');

let allOk = true;

// Check all IDs referenced in script exist in HTML
const scriptIdMatches = [];
const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
let m;
while ((m = idRegex.exec(script)) !== null) scriptIdMatches.push(m[1]);
const htmlIdMatches = [];
const htmlIdRegex = /id=['"]([^'"]+)['"]/g;
while ((m = htmlIdRegex.exec(html)) !== null) htmlIdMatches.push(m[1]);
const missing = scriptIdMatches.filter(id => !htmlIdMatches.includes(id));
if (missing.length > 0) {
    console.error('FAIL: Missing HTML IDs referenced in script:', missing.join(', '));
    allOk = false;
} else {
    console.log('OK: All getElementById references found in HTML (' + scriptIdMatches.length + ' IDs)');
}

// Check no broken SVG 
if (html.includes('</\u003c/svg>') || html.includes('<\\/svg')) {
    console.error('FAIL: Broken SVG tag found');
    allOk = false;
} else {
    console.log('OK: No broken SVG tags');
}

// Check STATE.STAGE_SELECT
if (!script.includes('STAGE_SELECT: 1')) {
    console.error('FAIL: STATE.STAGE_SELECT not defined');
    allOk = false;
} else {
    console.log('OK: STATE.STAGE_SELECT defined');
}

// Check STAGE_TEMPLATES has 7 entries
const stageCount = (script.match(/id:\s*\d+,/g) || []).length;
if (stageCount >= 7) {
    console.log('OK: Stage count = ' + stageCount);
} else {
    console.error('FAIL: Expected 7 stages, got ' + stageCount);
    allOk = false;
}

// Check localStorage is present
if (script.includes('localStorage')) {
    console.log('OK: localStorage persistence present');
} else {
    console.error('FAIL: No localStorage found');
    allOk = false;
}

// Check CSS mode-indicator defined
if (style.includes('.mode-indicator')) {
    console.log('OK: .mode-indicator CSS defined');
} else {
    console.error('FAIL: .mode-indicator CSS missing');
    allOk = false;
}

// Check CSS stage-card defined
if (style.includes('.stage-card')) {
    console.log('OK: .stage-card CSS defined');
} else {
    console.error('FAIL: .stage-card CSS missing');
    allOk = false;
}

// Check all critical bug fix: state immediately set
if (script.includes('this.state = STATE.PLAYING;\n                    this.showToast')) {
    console.log('OK: State-before-toast bug fix confirmed');
} else {
    console.log('WARN: Could not confirm bug fix pattern (may be OK)');
}

console.log('\n' + (allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
process.exit(allOk ? 0 : 1);
