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

async function assertPlayable(page, errors) {
  await page.goto(`http://127.0.0.1:${port}/girigiri-brake/`, { waitUntil: 'networkidle' });
  await page.click('#start-btn');
  await page.waitForSelector('#hud.active');

  const ready = await page.evaluate(() => ({
    status: document.querySelector('#status-text')?.textContent?.trim(),
    weather: document.querySelector('#weather-value')?.textContent?.trim(),
    canvas: (() => {
      const rect = document.querySelector('#game-canvas')?.getBoundingClientRect();
      return rect ? { width: rect.width, height: rect.height } : null;
    })(),
  }));

  if (ready.status !== 'TAP TO GO!' || !ready.weather) {
    throw new Error(`girigiri ready state is wrong: ${JSON.stringify(ready)}`);
  }
  if (!ready.canvas || ready.canvas.width <= 0 || ready.canvas.height <= 0) {
    throw new Error(`girigiri canvas is not visible: ${JSON.stringify(ready.canvas)}`);
  }

  await page.keyboard.press('Space');
  await page.waitForTimeout(320);
  const running = await page.evaluate(() => ({
    speed: Number.parseInt(document.querySelector('#speed-value')?.textContent ?? '0', 10),
    status: document.querySelector('#status-text')?.textContent?.trim(),
  }));
  if (!Number.isFinite(running.speed) || running.speed <= 0 || running.status !== 'DANGER!!') {
    throw new Error(`girigiri did not enter running state: ${JSON.stringify(running)}`);
  }

  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#result-screen')?.classList.contains('active'), null, { timeout: 4000 });
  const result = await page.evaluate(() => ({
    score: document.querySelector('#score-value')?.textContent?.trim(),
    rank: document.querySelector('#rank-text')?.textContent?.trim(),
  }));
  if (!result.score || !result.rank) throw new Error(`girigiri result is incomplete: ${JSON.stringify(result)}`);
  if (errors.length) throw new Error(`girigiri browser errors: ${errors.join(' | ')}`);
}

const server = createServer(serveFile);
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

try {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await assertPlayable(page, errors);
  await page.close();

  const storagePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
  await storagePage.goto(`http://127.0.0.1:${port}/girigiri-brake/`, { waitUntil: 'networkidle' });
  await storagePage.click('#start-btn');
  await storagePage.waitForSelector('#hud.active');
  if (storageErrors.length) throw new Error(`blocked storage should not break girigiri: ${storageErrors.join(' | ')}`);
  await storagePage.close();

  await browser.close();
  console.log('girigiri-brake browser test passed');
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
