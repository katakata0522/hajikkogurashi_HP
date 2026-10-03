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
const screenshots = process.env.MINIGAME_SCREENSHOT_DIR?.trim()
    ? (await import('./test-support/minigame-screenshots.mjs')).createMinigameScreenshots('kanji-slicer', `http://127.0.0.1:${port}`)
    : null;

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
  if (screenshots?.enabled) screenshots.track(page);
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
  if (screenshots?.enabled) await screenshots.capture(page, 'launch');

  const box = await page.locator('#game-canvas').boundingBox();
  if (!box) throw new Error('canvas bounding box is unavailable');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + Math.min(100, box.height / 3));
  await page.waitForTimeout(300);

  if (errors.length) throw new Error(`kanji-slicer interaction errors: ${errors.join(' | ')}`);

  // Real browser coverage for the repaired keyboard/focus and pointer paths.
  await page.evaluate(() => restartGame());
  const point = await page.evaluate(() => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (canvasOffsetX + previewX * canvasScale) * rect.width / canvas.width,
      y: rect.top + (canvasOffsetY + DROP_HEIGHT * canvasScale) * rect.height / canvas.height,
    };
  });
  await page.mouse.click(point.x, point.y, { button: 'right' });
  if (await page.evaluate(() => bodies.length !== 0)) throw new Error('right click dropped a piece');
  await page.mouse.click(point.x, point.y);
  if (await page.evaluate(() => bodies.length !== 1)) throw new Error('normal drop failed');
  await page.locator('#btn-pause').click();
  if (await page.locator('#btn-pause').getAttribute('aria-expanded') !== 'true') throw new Error('pause accessibility state is stale');
  if (await page.evaluate(() => document.activeElement.id !== 'btn-resume')) throw new Error('pause did not focus Resume');
  if (screenshots?.enabled) await screenshots.capture(page, 'pause-menu');
  await page.keyboard.press('Space');
  if (await page.evaluate(() => isPaused || document.activeElement.id !== 'btn-pause')) throw new Error('native Space/restore focus failed');
  await page.keyboard.press('Tab');
  const hiddenFocus = await page.evaluate(() => document.activeElement.closest('[hidden]') !== null);
  if (hiddenFocus) throw new Error('Tab entered a hidden modal');

  // Geometry assertions are distinct from human visual review. Exercise compact
  // phones, current large phones, short landscape, and a desktop viewport.
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [667, 375], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => { restartGame(); resize(); });
    const layout = await page.evaluate(() => {
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
      };
      return { viewport: { width: innerWidth, height: innerHeight }, header: rect('#game-header'), canvas: rect('#game-canvas'), footer: rect('#game-footer'),
        pause: rect('#btn-pause'), sound: rect('#btn-sound'), mission: rect('.mission-box'),
        scrollWidth: document.documentElement.scrollWidth,
        instructions: getComputedStyle(document.querySelector('#game-footer')).display,
        warningHidden: document.querySelector('#dead-line-alert').hidden };
    });
    if (layout.scrollWidth > width + 1) throw new Error(`horizontal overflow at ${width}x${height}: ${JSON.stringify(layout)}`);
    if (layout.canvas.height < 150 || layout.header.bottom > layout.canvas.y + 1 || layout.canvas.bottom > layout.footer.y + 1 || layout.footer.bottom > height + 1) {
      throw new Error(`overlapping or unusable layout at ${width}x${height}: ${JSON.stringify(layout)}`);
    }
    for (const control of [layout.pause, layout.sound]) {
      if (control.width < 44 || control.height < 44 || control.right > width + 1 || control.bottom > layout.header.bottom + 1) {
        throw new Error(`touch target clipped at ${width}x${height}: ${JSON.stringify(layout)}`);
      }
    }
    if (layout.instructions === 'none' || !layout.warningHidden) throw new Error('instructions/warning initial state incorrect');
    if (screenshots?.enabled && [320, 667, 1280].includes(width)) await screenshots.capture(page, 'play-hud');
    await page.locator('#btn-pause').click();
    await page.locator('#btn-resume').scrollIntoViewIfNeeded();
    await page.locator('#btn-resume').click();
    if (await page.evaluate(() => isPaused)) throw new Error(`cannot resume at ${width}x${height}`);
  }

  await page.evaluate(() => { addScore(25); triggerGameOver(); });
  if (!(await page.locator('#gameover-modal').isVisible())) throw new Error('gameover dialog missing');
  if (screenshots?.enabled) await screenshots.capture(page, 'result');
  await page.keyboard.press('Space');
  if (await page.evaluate(() => isGameOver || bodies.length !== 0 || score !== 0)) throw new Error('keyboard gameover restart failed');
  if (errors.length) throw new Error(`kanji-slicer lifecycle errors: ${errors.join(' | ')}`);

  const blockedPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  if (screenshots?.enabled) screenshots.track(blockedPage);
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
} catch (error) {
  if (screenshots?.enabled) await screenshots.captureFailure();
  throw error;
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
