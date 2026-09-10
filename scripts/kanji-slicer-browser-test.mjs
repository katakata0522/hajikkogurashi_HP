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

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/kanji-slicer/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);

  const initial = await page.evaluate(() => ({
    fixedStep: window.__KANJI_SLICER_FIXED_STEP__,
    mission: document.querySelector('#mission-kanji')?.textContent?.trim(),
    canvas: (() => {
      const rect = document.querySelector('#game-canvas')?.getBoundingClientRect();
      return rect ? { width: rect.width, height: rect.height } : null;
    })(),
    metaInsideBody: document.body.querySelector('meta') !== null,
  }));

  if (errors.length) throw new Error(`kanji-slicer page errors: ${errors.join(' | ')}`);
  if (!initial.fixedStep || initial.fixedStep.hz !== 60) {
    throw new Error(`fixed-step scheduler is not active: ${JSON.stringify(initial.fixedStep)}`);
  }
  if (!initial.mission) throw new Error('mission UI was not initialized');
  if (!initial.canvas || initial.canvas.width <= 0 || initial.canvas.height <= 0) {
    throw new Error(`canvas is not visible: ${JSON.stringify(initial.canvas)}`);
  }
  if (initial.metaInsideBody) throw new Error('SEO metadata must not be emitted inside body');

  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('canvas bounding box is unavailable');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + Math.min(100, box.height / 3));
  await page.waitForTimeout(300);

  if (errors.length) throw new Error(`kanji-slicer interaction errors: ${errors.join(' | ')}`);

  const blockedPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const blockedErrors = [];
  blockedPage.on('pageerror', (error) => blockedErrors.push(error.message));
  await blockedPage.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear']) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() { throw new Error(`blocked ${method}`); },
      });
    }
  });

  await blockedPage.goto(`http://127.0.0.1:${port}/kanji-slicer/`, { waitUntil: 'networkidle' });
  await blockedPage.waitForTimeout(150);
  const blockedResult = await blockedPage.evaluate(() => {
    let storageActuallyBlocked = false;
    try {
      localStorage.setItem('probe', '1');
    } catch (_) {
      storageActuallyBlocked = true;
    }
    const callable = typeof addScore === 'function';
    if (callable) addScore(10);
    return {
      storageActuallyBlocked,
      callable,
      score: document.querySelector('#score')?.textContent,
      best: document.querySelector('#best-score')?.textContent,
    };
  });

  if (!blockedResult.storageActuallyBlocked) throw new Error('blocked-storage fixture did not block localStorage');
  if (!blockedResult.callable) throw new Error('addScore must remain callable for regression coverage');
  if (blockedResult.score !== '10' || blockedResult.best !== '10') {
    throw new Error(`blocked-storage best update failed: ${JSON.stringify(blockedResult)}`);
  }
  if (blockedErrors.length) throw new Error(`kanji-slicer blocked-storage errors: ${blockedErrors.join(' | ')}`);

  await blockedPage.close();
  await page.close();
  await browser.close();
  console.log('kanji-slicer browser test passed');
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
