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

const server = createServer(serveFile);
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

async function waitForResult(page) {
  await page.waitForFunction(
    () => document.querySelector('#result-screen').classList.contains('active'),
    null,
    { timeout: 9000 }
  );
}

try {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const storagePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  storagePage.on('pageerror', (error) => errors.push(error.message));
  await storagePage.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', {
      value() {
        throw new Error('blocked getItem');
      },
      configurable: true,
    });
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() {
        throw new Error('blocked setItem');
      },
      configurable: true,
    });
  });
  await storagePage.goto(`http://127.0.0.1:${port}/stealth-slacker/`, { waitUntil: 'networkidle' });
  await storagePage.click('#start-btn');
  await waitForResult(storagePage);
  const storageResult = await storagePage.evaluate(() => ({
    resultActive: document.querySelector('#result-screen').classList.contains('active'),
    stressHidden: document.querySelector('#stress-hud').classList.contains('hidden'),
    best: document.querySelector('#best-score-value').textContent,
  }));
  if (errors.length) throw new Error(`storage failure should not surface page errors: ${errors.join(' | ')}`);
  if (!storageResult.resultActive || !storageResult.stressHidden || storageResult.best !== '--') {
    throw new Error(`storage failure did not still show a clean result: ${JSON.stringify(storageResult)}`);
  }
  await storagePage.close();

  const zeroScorePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await zeroScorePage.goto(`http://127.0.0.1:${port}/stealth-slacker/`, { waitUntil: 'networkidle' });
  await zeroScorePage.evaluate(() => localStorage.removeItem('stealth_best_score'));
  await zeroScorePage.click('#start-btn');
  await waitForResult(zeroScorePage);
  const zeroScoreResult = await zeroScorePage.evaluate(() => ({
    bestText: document.querySelector('#best-score-value').textContent,
    storedBest: localStorage.getItem('stealth_best_score'),
  }));
  if (zeroScoreResult.bestText !== '--' || zeroScoreResult.storedBest !== null) {
    throw new Error(`zero-point game should not be stored as best: ${JSON.stringify(zeroScoreResult)}`);
  }
  await zeroScorePage.close();

  const restartPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await restartPage.goto(`http://127.0.0.1:${port}/stealth-slacker/`, { waitUntil: 'networkidle' });
  await restartPage.tap('#start-btn');
  await waitForResult(restartPage);
  await restartPage.touchscreen.tap(200, 420);
  await restartPage.waitForTimeout(100);
  await restartPage.touchscreen.tap(200, 420);
  await restartPage.waitForTimeout(300);
  const restartResult = await restartPage.evaluate(() => ({
    resultActive: document.querySelector('#result-screen').classList.contains('active'),
    scoreHudHidden: document.querySelector('#score-hud').classList.contains('hidden'),
  }));
  if (restartResult.resultActive || restartResult.scoreHudHidden) {
    throw new Error(`double tap did not restart from result: ${JSON.stringify(restartResult)}`);
  }
  await restartPage.close();

  const sharePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await sharePage.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await sharePage.goto(`http://127.0.0.1:${port}/stealth-slacker/`, { waitUntil: 'networkidle' });
  await sharePage.evaluate(() => {
    window.__openedShare = null;
    window.open = (url, target, features) => {
      window.__openedShare = { url, target, features };
      return { closed: false };
    };
  });
  await sharePage.click('#start-btn');
  await waitForResult(sharePage);
  await sharePage.click('#share-btn');
  const shareResult = await sharePage.evaluate(() => window.__openedShare);
  if (!shareResult || shareResult.target !== '_blank' || shareResult.features !== 'noopener,noreferrer') {
    throw new Error(`share fallback did not open safely: ${JSON.stringify(shareResult)}`);
  }
  await sharePage.close();

  const clipboardPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await clipboardPage.addInitScript(() => {
    window.__copiedShareText = null;
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText(text) {
          window.__copiedShareText = text;
          return Promise.resolve();
        },
      },
      configurable: true,
    });
    window.open = () => {
      throw new Error('window.open should not run when clipboard succeeds');
    };
  });
  await clipboardPage.goto(`http://127.0.0.1:${port}/stealth-slacker/`, { waitUntil: 'networkidle' });
  await clipboardPage.click('#start-btn');
  await waitForResult(clipboardPage);
  await clipboardPage.click('#share-btn');
  await clipboardPage.waitForFunction(() => document.querySelector('#share-btn').classList.contains('copied'));
  const clipboardResult = await clipboardPage.evaluate(() => ({
    copied: window.__copiedShareText,
    buttonText: document.querySelector('#share-btn').textContent,
  }));
  if (!clipboardResult.copied?.includes('https://hajikkoroom.xsrv.jp/stealth-slacker/') || !clipboardResult.buttonText.includes('コピー')) {
    throw new Error(`clipboard share did not show feedback: ${JSON.stringify(clipboardResult)}`);
  }
  await clipboardPage.close();

  const darkModePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await darkModePage.goto(`http://127.0.0.1:${port}/stealth-slacker/`, { waitUntil: 'networkidle' });
  await darkModePage.tap('.dark-mode-label');
  const darkModeResult = await darkModePage.evaluate(() => ({
    dark: document.body.classList.contains('dark-mode'),
    checked: document.querySelector('#dark-mode-toggle').checked,
  }));
  if (!darkModeResult.dark || !darkModeResult.checked) {
    throw new Error(`dark mode toggle is not clickable: ${JSON.stringify(darkModeResult)}`);
  }
  await darkModePage.close();

  await browser.close();
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
