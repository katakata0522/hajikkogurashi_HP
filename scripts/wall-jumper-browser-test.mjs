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

  async function captureSeededPlatforms(seed) {
    const seededPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const seededErrors = [];
    seededPage.on('pageerror', (error) => seededErrors.push(error.message));
    await seededPage.goto(`http://127.0.0.1:${port}/wall-jumper/?seed=${seed}`, { waitUntil: 'networkidle' });
    const exposedSeed = await seededPage.evaluate(() => window.__CORNER_NEIGHBOR_GAME_SEED__);
    if (exposedSeed !== seed) {
      throw new Error(`seed bootstrap mismatch: expected ${seed}, got ${exposedSeed}`);
    }
    await seededPage.click('#start-btn');
    await seededPage.waitForTimeout(100);
    const sample = await seededPage.evaluate(() => eval(`platforms.slice(0, 12).map((p) => ({
      x: Number(p.x.toFixed(4)),
      y: Number(p.y.toFixed(4)),
      width: Number(p.width.toFixed(4)),
      height: Number(p.height.toFixed(4))
    }))`));
    const currentUrl = seededPage.url();
    await seededPage.close();
    if (seededErrors.length) {
      throw new Error(`seeded run page errors: ${JSON.stringify(seededErrors)}`);
    }
    return { sample, currentUrl };
  }

  const seededA = await captureSeededPlatforms(424242);
  const seededB = await captureSeededPlatforms(424242);
  const seededC = await captureSeededPlatforms(424243);
  if (JSON.stringify(seededA.sample) !== JSON.stringify(seededB.sample)) {
    throw new Error('same Wall Jumper seed did not reproduce the same platform layout');
  }
  if (JSON.stringify(seededA.sample) === JSON.stringify(seededC.sample)) {
    throw new Error('different Wall Jumper seeds unexpectedly produced the same platform sample');
  }
  if (!seededA.currentUrl.includes('seed=424242')) {
    throw new Error(`seed was not preserved in the run URL: ${seededA.currentUrl}`);
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/wall-jumper/`, { waitUntil: 'networkidle' });
  const generatedSeedState = await page.evaluate(() => ({
    seed: window.__CORNER_NEIGHBOR_GAME_SEED__,
    url: window.location.href,
  }));
  if (!Number.isInteger(generatedSeedState.seed) || generatedSeedState.seed <= 0 || !generatedSeedState.url.includes('seed=')) {
    throw new Error(`automatic run seed was not exposed/persisted: ${JSON.stringify(generatedSeedState)}`);
  }

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
    // Isolate the wall-kick unit from procedural geometry and the user-input debounce.
    // Keep one non-overlapping platform because update() relies on a non-empty platform list.
    platforms.splice(0, platforms.length, {
      x: 140,
      y: canvas.height - 40,
      width: 120,
      height: 10
    });
    lastJumpTime = -Infinity;
    wallKickLockFrames = 0;
    player.x = 0;
    player.y = 300;
    player.vx = -1;
    player.vy = 2;
    player.coyoteTimer = 0;
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

  // 回帰テスト: タイトル画面で R を押したら、タイトルの文字やボタンを消してから始まる
  const qaPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await qaPage.goto(`http://127.0.0.1:${port}/wall-jumper/`, { waitUntil: 'networkidle' });
  await qaPage.keyboard.press('KeyR');
  const rOnTitle = await qaPage.evaluate(() => ({
    state: eval('gameState'),
    title: getComputedStyle(document.querySelector('#title')).display,
    startBtn: getComputedStyle(document.querySelector('#start-btn')).display,
  }));
  if (rOnTitle.state !== 'playing' || rOnTitle.title !== 'none' || rOnTitle.startBtn !== 'none') {
    throw new Error(`R on title left the title UI over the game: ${JSON.stringify(rOnTitle)}`);
  }

  // 回帰テスト: P キーでの一時停止・再開も、ボタンと同じく一時停止ボタンを出し入れする
  await qaPage.keyboard.press('KeyP');
  const pausedByKey = await qaPage.evaluate(() => ({ state: eval('gameState'), pauseBtn: getComputedStyle(document.querySelector('#pause-btn')).display }));
  await qaPage.keyboard.press('KeyP');
  const resumedByKey = await qaPage.evaluate(() => ({ state: eval('gameState'), pauseBtn: getComputedStyle(document.querySelector('#pause-btn')).display }));
  if (pausedByKey.state !== 'paused' || pausedByKey.pauseBtn !== 'none' || resumedByKey.state !== 'playing' || resumedByKey.pauseBtn === 'none') {
    throw new Error(`keyboard pause is inconsistent: ${JSON.stringify({ pausedByKey, resumedByKey })}`);
  }
  // 回帰テスト: トゲに当たらずに「タイトルへ」でやめても、その回の到達点が最高記録に残る
  await qaPage.evaluate(() => { eval('maxDistance = 37'); });
  await qaPage.keyboard.press('KeyP');
  await qaPage.click('#quit-btn');
  const savedAfterQuit = await qaPage.evaluate(() => ({ stored: localStorage.getItem('wallJumperBestDistance'), text: document.querySelector('#best-time-display').textContent }));
  if (savedAfterQuit.stored !== '37' || !savedAfterQuit.text.includes('37')) {
    throw new Error(`run record was lost when quitting: ${JSON.stringify(savedAfterQuit)}`);
  }
  await qaPage.close();

  // 回帰テスト: 横向きの案内が出たら一時停止する
  const landscapePage = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await landscapePage.goto(`http://127.0.0.1:${port}/wall-jumper/`, { waitUntil: 'networkidle' });
  await landscapePage.waitForFunction(() => document.querySelector('.cn-rotate-hint.is-visible'));
  await landscapePage.evaluate(() => {
    const hint = document.querySelector('.cn-rotate-hint');
    hint.classList.remove('is-visible');
    document.querySelector('#start-btn').click();
    hint.classList.add('is-visible');
  });
  await landscapePage.waitForTimeout(300);
  const hintState = await landscapePage.evaluate(() => eval('gameState'));
  if (hintState !== 'paused') throw new Error(`game kept running behind the rotate hint: ${hintState}`);
  await landscapePage.close();

  await browser.close();
  console.log('wall-jumper browser test passed');
} finally {
  server.close();
}
