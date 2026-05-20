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

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/wall-jumper/`, { waitUntil: 'networkidle' });
  const initial = await page.evaluate(() => ({
    state: eval('gameState'),
    hud: getComputedStyle(document.querySelector('#hud')).display,
    pause: getComputedStyle(document.querySelector('#pause-btn')).display,
    clearScreen: document.querySelector('#game-clear'),
  }));
  if (initial.state !== 'start' || initial.hud !== 'none' || initial.pause !== 'none' || initial.clearScreen !== null) {
    throw new Error(`initial endless UI is wrong: ${JSON.stringify(initial)}`);
  }

  await page.click('#start-btn');
  await page.waitForTimeout(300);
  const playing = await page.evaluate(() => ({
    state: eval('gameState'),
    hud: getComputedStyle(document.querySelector('#hud')).display,
    pause: getComputedStyle(document.querySelector('#pause-btn')).display,
  }));
  if (playing.state !== 'playing' || playing.hud !== 'flex' || playing.pause !== 'flex') {
    throw new Error(`start did not enter playable state: ${JSON.stringify(playing)}`);
  }

  const wallKick = await page.evaluate(() => eval(`(() => {
    player.x = 0;
    player.y = 300;
    player.vx = -1;
    player.vy = 2;
    player.wasGrounded = false;
    player.canDoubleJump = false;
    jump();
    const beforeUpdate = player.vx;
    update();
    return { beforeUpdate, afterUpdate: player.vx, lock: wallKickLockFrames };
  })()`));
  if (wallKick.beforeUpdate !== 8 || wallKick.afterUpdate !== 8 || wallKick.lock <= 0) {
    throw new Error(`wall kick impulse was cancelled too early: ${JSON.stringify(wallKick)}`);
  }

  await page.evaluate(() => eval('maxDistance = 9; player.y = cameraY + canvas.height + 200;'));
  await page.waitForTimeout(120);
  const dead = await page.evaluate(() => ({
    state: eval('gameState'),
    flash: document.querySelector('#run-flash').classList.contains('show'),
    best: document.querySelector('#best-time-display').textContent,
  }));
  if (dead.state !== 'dead' || !dead.flash || dead.best !== 'BEST 9m') {
    throw new Error(`retry feedback or best update failed: ${JSON.stringify(dead)}`);
  }
  await page.waitForTimeout(650);
  const retried = await page.evaluate(() => ({
    state: eval('gameState'),
    score: document.querySelector('#score-display').textContent,
  }));
  if (retried.state !== 'playing' || retried.score !== '0m') {
    throw new Error(`death should auto-retry without a result screen: ${JSON.stringify(retried)}`);
  }
  await page.close();

  const storagePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const storageErrors = [];
  storagePage.on('pageerror', (error) => storageErrors.push(error.message));
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
  await storagePage.goto(`http://127.0.0.1:${port}/wall-jumper/`, { waitUntil: 'networkidle' });
  await storagePage.click('#start-btn');
  await storagePage.waitForTimeout(200);
  const storageState = await storagePage.evaluate(() => ({
    state: eval('gameState'),
    best: document.querySelector('#best-time-display').textContent,
  }));
  if (storageErrors.length || storageState.state !== 'playing' || storageState.best !== 'BEST --m') {
    throw new Error(`storage errors should not break play: ${JSON.stringify({ storageErrors, storageState })}`);
  }
  await storagePage.close();

  await browser.close();
  console.log('wall-jumper browser test passed');
} finally {
  server.close();
}
