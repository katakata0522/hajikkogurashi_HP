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

try {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const catalogPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  catalogPage.on('pageerror', (error) => errors.push(error.message));
  await catalogPage.goto(`http://127.0.0.1:${port}/blackhole-sweeper/`, { waitUntil: 'networkidle' });
  await catalogPage.evaluate(() => localStorage.setItem('blackhole_best_score', '6000'));
  await catalogPage.tap('#trophy-btn');
  const openState = await catalogPage.evaluate(() => ({
    hidden: document.querySelector('#achievements-modal').classList.contains('hidden'),
    unlocked: document.querySelectorAll('.achievement-card.unlocked').length,
    locked: document.querySelectorAll('.achievement-card.locked').length,
    text: document.querySelector('#achievements-list').textContent,
  }));
  if (errors.length) throw new Error(`catalog page errors: ${errors.join(' | ')}`);
  if (openState.hidden || openState.unlocked < 3 || !openState.text.includes('炎上プロジェクトキラー')) {
    throw new Error(`achievement catalog did not open correctly: ${JSON.stringify(openState)}`);
  }
  await catalogPage.tap('#close-modal-btn');
  const closed = await catalogPage.evaluate(() => document.querySelector('#achievements-modal').classList.contains('hidden'));
  if (!closed) throw new Error('achievement catalog did not close');
  await catalogPage.close();

  const startGuardPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await startGuardPage.goto(`http://127.0.0.1:${port}/blackhole-sweeper/`, { waitUntil: 'networkidle' });
  await startGuardPage.touchscreen.tap(20, 20);
  await startGuardPage.waitForTimeout(100);
  await startGuardPage.touchscreen.tap(20, 20);
  await startGuardPage.waitForTimeout(250);
  const guardedStart = await startGuardPage.evaluate(() => ({
    startActive: document.querySelector('#start-screen').classList.contains('active'),
    hudHidden: document.querySelector('#hud').classList.contains('hidden'),
  }));
  if (!guardedStart.startActive || !guardedStart.hudHidden) {
    throw new Error(`double-tap on start screen should not start the game: ${JSON.stringify(guardedStart)}`);
  }
  await startGuardPage.evaluate(() => localStorage.setItem('blackhole_best_score', '6000'));
  await startGuardPage.tap('#trophy-btn');
  await startGuardPage.touchscreen.tap(20, 20);
  await startGuardPage.waitForTimeout(100);
  await startGuardPage.touchscreen.tap(20, 20);
  await startGuardPage.waitForTimeout(250);
  const guardedModal = await startGuardPage.evaluate(() => ({
    modalHidden: document.querySelector('#achievements-modal').classList.contains('hidden'),
    startActive: document.querySelector('#start-screen').classList.contains('active'),
    hudHidden: document.querySelector('#hud').classList.contains('hidden'),
  }));
  if (guardedModal.modalHidden || !guardedModal.startActive || !guardedModal.hudHidden) {
    throw new Error(`double-tap behind achievement modal should not start the game: ${JSON.stringify(guardedModal)}`);
  }
  await startGuardPage.close();

  const sharePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await sharePage.addInitScript(() => {
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
  await sharePage.goto(`http://127.0.0.1:${port}/blackhole-sweeper/`, { waitUntil: 'networkidle' });
  await sharePage.evaluate(() => {
    document.querySelector('#start-screen').classList.remove('active');
    document.querySelector('#result-screen').classList.add('active');
    document.querySelector('#rank-text').textContent = '炎上プロジェクトキラー';
    document.querySelector('#final-score').textContent = '5000';
  });
  await sharePage.click('#share-btn');
  await sharePage.waitForFunction(() => document.querySelector('#toast-container').textContent.includes('コピー'));
  const shareResult = await sharePage.evaluate(() => ({
    copied: window.__copiedShareText,
    toast: document.querySelector('#toast-container').textContent,
  }));
  if (!shareResult.copied?.includes('https://hajikkoroom.xsrv.jp/blackhole-sweeper/') || !shareResult.toast.includes('コピー')) {
    throw new Error(`clipboard share did not show feedback: ${JSON.stringify(shareResult)}`);
  }
  await sharePage.close();

  const popupPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await popupPage.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    window.__openedShare = null;
    window.open = (url, target, features) => {
      window.__openedShare = { url, target, features };
      return { closed: false };
    };
  });
  await popupPage.goto(`http://127.0.0.1:${port}/blackhole-sweeper/`, { waitUntil: 'networkidle' });
  await popupPage.evaluate(() => {
    document.querySelector('#start-screen').classList.remove('active');
    document.querySelector('#result-screen').classList.add('active');
  });
  await popupPage.click('#share-btn');
  const popupResult = await popupPage.evaluate(() => window.__openedShare);
  if (!popupResult || popupResult.target !== '_blank' || popupResult.features !== 'noopener,noreferrer') {
    throw new Error(`share popup fallback was not safe: ${JSON.stringify(popupResult)}`);
  }
  await popupPage.close();

  await browser.close();
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
