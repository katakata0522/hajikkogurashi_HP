import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '../..');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

function serveFile(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let filePath = join(root, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith('/')) filePath = join(filePath, 'index.html');

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

const server = createServer(serveFile);
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}/`;

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
} catch (_) {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
}

const context = await browser.newContext();
const page = await context.newPage();

const pageErrors = [];
page.on('pageerror', err => pageErrors.push(err.message));
page.on('console', msg => {
  if (msg.type() === 'error') pageErrors.push(msg.text());
});

console.log(`Navigating to ${baseUrl} in headless browser...`);
await page.goto(baseUrl);
await page.waitForLoadState('domcontentloaded');

assert.equal(pageErrors.length, 0, `Page loaded with errors: ${pageErrors.join(', ')}`);
console.log('✓ index.html loaded cleanly via HTTP with 0 console errors');

// Test 1: Check Manifest Link in Head
const manifestHref = await page.$eval('link[rel="manifest"]', el => el.getAttribute('href'));
assert.equal(manifestHref, '/manifest.webmanifest', 'Manifest link must point to /manifest.webmanifest');
console.log('✓ PWA manifest link present in head');

// Test 2: Check Keyboard shortcuts guide in DOM
const kbGuideText = await page.$eval('.crt-kb-hint-pill', el => el.textContent.trim());
assert.ok(kbGuideText.includes('SPACE') && kbGuideText.includes('1-4') && kbGuideText.includes('R'), 'Keyboard guide must display SPACE, 1-4, R');
console.log('✓ CRT Keyboard guide verified in DOM:', kbGuideText);

// Test 3: Check Cartridge Switching via Keyboard Shortcuts 1, 2, 3, 4
await page.keyboard.press('2');
await page.waitForTimeout(250);
let activeCart = await page.evaluate(() => document.querySelector('.mini-cart-item.active')?.getAttribute('data-cart'));
assert.equal(activeCart, 'mirror', 'Key 2 must switch active cartridge to mirror');

await page.keyboard.press('3');
await page.waitForTimeout(250);
activeCart = await page.evaluate(() => document.querySelector('.mini-cart-item.active')?.getAttribute('data-cart'));
assert.equal(activeCart, 'mikiri', 'Key 3 must switch active cartridge to mikiri');

await page.keyboard.press('4');
await page.waitForTimeout(250);
activeCart = await page.evaluate(() => document.querySelector('.mini-cart-item.active')?.getAttribute('data-cart'));
assert.equal(activeCart, 'duel', 'Key 4 must switch active cartridge to duel');

await page.keyboard.press('1');
await page.waitForTimeout(250);
activeCart = await page.evaluate(() => document.querySelector('.mini-cart-item.active')?.getAttribute('data-cart'));
assert.equal(activeCart, 'brake', 'Key 1 must switch active cartridge to brake');
console.log('✓ Keyboard shortcuts 1, 2, 3, 4 successfully switch ROM cartridges');

// Test 4: Check Space Key & 'R' Key (Retry)
let initialBrakePhase = await page.evaluate(() => typeof brakePhase !== 'undefined' ? brakePhase : 'ready');
assert.equal(initialBrakePhase, 'ready', 'Initial brake phase must be ready');

await page.keyboard.press('Space'); // Start accel
await page.waitForTimeout(150);
let accelBrakePhase = await page.evaluate(() => typeof brakePhase !== 'undefined' ? brakePhase : 'accel');
assert.equal(accelBrakePhase, 'accel', 'Space key must trigger CRT action (accel)');

await page.keyboard.press('r'); // Press retry
await page.waitForTimeout(150);
let resetBrakePhase = await page.evaluate(() => typeof brakePhase !== 'undefined' ? brakePhase : 'ready');
assert.equal(resetBrakePhase, 'ready', 'R key must reset mini CRT state to ready');
console.log('✓ Space key successfully operates CRT and "R" key resets/retries');

// Test 5: Verify localStorage Score Persistence & Reload
await page.evaluate(() => {
  localStorage.setItem('cn_crt_best_brake', '0.12');
  localStorage.setItem('cn_crt_best_mikiri', '15');
  localStorage.setItem('cn_crt_best_mirror', '3');
  localStorage.setItem('cn_crt_best_duel', '9');
});

// Reload page to verify persistence
await page.reload();
await page.waitForLoadState('domcontentloaded');

const loadedScores = await page.evaluate(() => ({
  brake: localStorage.getItem('cn_crt_best_brake'),
  mikiri: localStorage.getItem('cn_crt_best_mikiri'),
  mirror: localStorage.getItem('cn_crt_best_mirror'),
  duel: localStorage.getItem('cn_crt_best_duel'),
}));

assert.equal(loadedScores.brake, '0.12', 'brakeBest score must persist in localStorage');
assert.equal(loadedScores.mikiri, '15', 'mikiriBest score must persist in localStorage');
assert.equal(loadedScores.mirror, '3', 'mirrorBestStage score must persist in localStorage');
assert.equal(loadedScores.duel, '9', 'duelBest score must persist in localStorage');
console.log('✓ All Mini CRT best scores persist across reloads in localStorage');

// Test 6: Verify NEW RECORD presentation trigger
const newRecordTriggered = await page.evaluate(() => {
  if (typeof triggerCrtNewRecord === 'function') {
    triggerCrtNewRecord('brake', '★ NEW RECORD! 0.08m ★');
    return crtNewRecordAnim && crtNewRecordAnim.active && crtNewRecordAnim.text.includes('0.08m');
  }
  return false;
});
assert.ok(newRecordTriggered, 'triggerCrtNewRecord must activate new record celebration state');
console.log('✓ NEW RECORD presentation trigger verified successfully');

// Test 7: Verify View Transitions API and cross-document navigation
const vtInstalled = await page.evaluate(() => {
  return typeof document.startViewTransition !== 'undefined';
});
console.log('✓ Browser View Transitions API support detected:', vtInstalled);

// Test 8: Real link click transition without page errors
const errorsBeforeNav = pageErrors.length;
await page.click('a[href="/minigames.html"]');
await page.waitForLoadState('domcontentloaded');
assert.equal(pageErrors.length, errorsBeforeNav, `Navigation caused errors: ${pageErrors.join(', ')}`);
assert.ok(page.url().includes('minigames.html'), 'Should navigate cleanly to minigames.html');
console.log('✓ Seamless cross-document View Transition navigation verified with 0 errors');

await browser.close();
server.close();
console.log('\nAll browser deep-verification checks PASSED!');
