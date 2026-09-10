import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(import.meta.dirname, '..');
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
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

async function primaryPointerDown(page, selector) {
  await page.dispatchEvent(selector, 'pointerdown', {
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
  });
}

const server = createServer(serveFile);
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

try {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/mikiri-issen/`, { waitUntil: 'networkidle' });

  const initial = await page.evaluate(() => ({
    titleActive: document.querySelector('#titleScreen')?.classList.contains('is-active') === true,
    playActive: document.querySelector('#playScreen')?.classList.contains('is-active') === true,
    resultActive: document.querySelector('#resultScreen')?.classList.contains('is-active') === true,
    best: document.querySelector('#titleBestLabel')?.textContent?.trim(),
    startText: document.querySelector('#startButton')?.textContent?.trim(),
  }));
  if (!initial.titleActive || initial.playActive || initial.resultActive || initial.startText !== '決闘開始' || errors.length) {
    throw new Error(`initial Mikiri screen is wrong: ${JSON.stringify({ initial, errors })}`);
  }

  // The app intentionally reacts on pointerdown for low-latency touch input.
  // Dispatch that event directly so the modal opening itself does not cause Playwright's
  // synthetic click action to retry against the newly opened overlay.
  await primaryPointerDown(page, '#howtoButton');
  await page.waitForTimeout(20);
  const howtoOpen = await page.evaluate(() => ({
    open: document.querySelector('#howtoPanel')?.classList.contains('is-open') === true,
    ariaHidden: document.querySelector('#howtoPanel')?.getAttribute('aria-hidden'),
  }));
  if (!howtoOpen.open || howtoOpen.ariaHidden !== 'false' || errors.length) {
    throw new Error(`how-to panel did not open correctly: ${JSON.stringify({ howtoOpen, errors })}`);
  }

  // Escape is the documented keyboard-safe close route while the panel is open.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(20);
  const howtoClosed = await page.evaluate(() => ({
    open: document.querySelector('#howtoPanel')?.classList.contains('is-open') === true,
    ariaHidden: document.querySelector('#howtoPanel')?.getAttribute('aria-hidden'),
  }));
  if (howtoClosed.open || howtoClosed.ariaHidden !== 'true' || errors.length) {
    throw new Error(`how-to panel did not close correctly: ${JSON.stringify({ howtoClosed, errors })}`);
  }

  await primaryPointerDown(page, '#startButton');
  await page.waitForTimeout(120);
  const playing = await page.evaluate(() => ({
    titleActive: document.querySelector('#titleScreen')?.classList.contains('is-active') === true,
    playActive: document.querySelector('#playScreen')?.classList.contains('is-active') === true,
    resultActive: document.querySelector('#resultScreen')?.classList.contains('is-active') === true,
    stateText: document.querySelector('#stateLabel')?.textContent?.trim(),
  }));
  if (playing.titleActive || !playing.playActive || playing.resultActive || errors.length) {
    throw new Error(`Mikiri did not enter play state: ${JSON.stringify({ playing, errors })}`);
  }

  // The first 220ms are intentionally ignored to avoid accidental double-triggering from the start action.
  // After that guard window, an input before the signal must exercise the foul/restart path without crashing.
  await page.waitForTimeout(180);
  await primaryPointerDown(page, '#arena');
  await page.waitForTimeout(250);
  const foul = await page.evaluate(() => ({
    badgeVisible: getComputedStyle(document.querySelector('#topleftFoulBadge')).display !== 'none',
    badgeText: document.querySelector('#topleftFoulBadge')?.textContent?.trim() || '',
    titleActive: document.querySelector('#titleScreen')?.classList.contains('is-active') === true,
  }));
  if (!foul.badgeVisible || !foul.badgeText.includes('お手つき') || foul.titleActive || errors.length) {
    throw new Error(`Mikiri first-foul recovery path failed: ${JSON.stringify({ foul, errors })}`);
  }

  await page.close();

  const storagePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const storageErrors = [];
  storagePage.on('pageerror', (error) => storageErrors.push(error.message));
  await storagePage.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', {
      value() { throw new Error('blocked getItem'); },
      configurable: true,
    });
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() { throw new Error('blocked setItem'); },
      configurable: true,
    });
  });
  await storagePage.goto(`http://127.0.0.1:${port}/mikiri-issen/`, { waitUntil: 'networkidle' });
  const storageState = await storagePage.evaluate(() => ({
    titleActive: document.querySelector('#titleScreen')?.classList.contains('is-active') === true,
    best: document.querySelector('#titleBestLabel')?.textContent?.trim(),
  }));
  if (storageErrors.length || !storageState.titleActive) {
    throw new Error(`Mikiri blocked-storage startup failed: ${JSON.stringify({ storageErrors, storageState })}`);
  }
  await primaryPointerDown(storagePage, '#startButton');
  await storagePage.waitForTimeout(100);
  const storagePlay = await storagePage.evaluate(() => document.querySelector('#playScreen')?.classList.contains('is-active') === true);
  if (!storagePlay || storageErrors.length) {
    throw new Error(`Mikiri blocked-storage play failed: ${JSON.stringify({ storagePlay, storageErrors })}`);
  }
  await storagePage.close();

  await browser.close();
  console.log('mikiri-issen browser test passed');
} finally {
  server.close();
}
