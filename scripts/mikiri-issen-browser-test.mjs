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
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/mikiri-issen/`, { waitUntil: 'networkidle' });
  const initial = await page.evaluate(() => ({
    titleActive: document.querySelector('#titleScreen')?.classList.contains('is-active'),
    startText: document.querySelector('#startButton')?.textContent?.trim(),
  }));
  if (!initial.titleActive || initial.startText !== '決闘開始') {
    throw new Error(`mikiri title state is wrong: ${JSON.stringify(initial)}`);
  }

  await page.click('#startButton');
  await page.waitForSelector('#playScreen.is-active');
  await page.waitForFunction(() => document.querySelector('#stateLabel')?.textContent?.trim() === '今！', null, { timeout: 5000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#resultScreen')?.classList.contains('is-active'), null, { timeout: 3000 });

  const result = await page.evaluate(() => ({
    reaction: document.querySelector('#resultTime')?.textContent?.trim(),
    rank: document.querySelector('#rankBadge')?.textContent?.trim(),
    difference: document.querySelector('#differenceLabel')?.textContent?.trim(),
  }));
  if (!result.reaction || !result.rank || !result.difference) {
    throw new Error(`mikiri result is incomplete: ${JSON.stringify(result)}`);
  }
  if (errors.length) throw new Error(`mikiri browser errors: ${errors.join(' | ')}`);

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
  await storagePage.goto(`http://127.0.0.1:${port}/mikiri-issen/`, { waitUntil: 'networkidle' });
  await storagePage.click('#startButton');
  await storagePage.waitForSelector('#playScreen.is-active');
  if (storageErrors.length) throw new Error(`blocked storage should not break mikiri: ${storageErrors.join(' | ')}`);
  await storagePage.close();

  await browser.close();
  console.log('mikiri-issen browser test passed');
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
