import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

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
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
  });

  await page.goto(`http://127.0.0.1:${port}/sorting-factory/`, { waitUntil: 'networkidle' });
  await page.tap('#start-btn');
  await page.waitForFunction(() => !document.querySelector('#score-hud').classList.contains('hidden'));
  await page.waitForTimeout(1700);

  const normalHitTarget = await page.evaluate(() => ({
    left: document.elementFromPoint(80, 500)?.id,
    right: document.elementFromPoint(310, 500)?.id,
  }));

  if (normalHitTarget.left !== 'touch-left' || normalHitTarget.right !== 'touch-right') {
    throw new Error(`touch zones are not above the canvas: ${JSON.stringify(normalHitTarget)}`);
  }

  await page.evaluate(() => {
    document.querySelector('#touch-left').style.pointerEvents = 'none';
    document.querySelector('#touch-right').style.pointerEvents = 'none';
  });

  const fallbackHitTarget = await page.evaluate(() => document.elementFromPoint(80, 500)?.id);
  if (fallbackHitTarget !== 'game-canvas') {
    throw new Error(`canvas fallback is not reachable: ${fallbackHitTarget}`);
  }

  await page.touchscreen.tap(80, 500);
  await page.waitForTimeout(250);

  const result = await page.evaluate(() => ({
    score: document.querySelector('#score-value').textContent,
    resultActive: document.querySelector('#result-screen').classList.contains('active'),
  }));

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  if (result.score === '0' && !result.resultActive) {
    throw new Error(`canvas fallback did not process input: ${JSON.stringify(result)}`);
  }

  await browser.close();
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
