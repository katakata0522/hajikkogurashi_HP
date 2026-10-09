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
  const initialLogicalHeight = await page.evaluate(() => eval('CONFIG.LOGICAL_HEIGHT'));
  if (initialLogicalHeight !== 1000) {
    throw new Error(`logical height should stay fixed across aspect ratios: ${initialLogicalHeight}`);
  }

  await page.tap('#start-btn');
  await page.waitForFunction(() => !document.querySelector('#score-hud').classList.contains('hidden'));
  const initialRuleLabel = (await page.locator('#current-rule-text').textContent())?.trim();
  if (initialRuleLabel !== '色') {
    throw new Error(`initial rule label changed after ID separation: ${initialRuleLabel}`);
  }
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

  // 回帰テスト: 横向きスマホで「縦向きにしてね」が出ている間は、アイテムが落ちない（案内の裏で負けない）
  const landscape = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  landscape.on('pageerror', (error) => errors.push(error.message));
  await landscape.goto(`http://127.0.0.1:${port}/sorting-factory/`, { waitUntil: 'networkidle' });
  await landscape.waitForFunction(() => document.querySelector('.cn-rotate-hint.is-visible'));
  await landscape.evaluate(() => {
    document.querySelector('.cn-rotate-hint').classList.remove('is-visible');
    document.querySelector('#start-btn').click();
    document.querySelector('.cn-rotate-hint').classList.add('is-visible');
  });
  await landscape.waitForTimeout(4500);
  const pausedState = await landscape.evaluate(() => ({
    hud: document.querySelector('#score-value').textContent,
    resultActive: document.querySelector('#result-screen').classList.contains('active'),
  }));
  if (pausedState.resultActive) throw new Error('game ended behind the rotate hint');
  await landscape.locator('.cn-rotate-hint__button').click();
  await landscape.waitForFunction(() => document.querySelector('#result-screen').classList.contains('active'), null, { timeout: 15000 });

  // 回帰テスト: ゲームオーバー直後の Enter 連打では再挑戦が始まらず、少し待てば始まる
  await landscape.keyboard.press('Enter');
  const immediately = await landscape.evaluate(() => document.querySelector('#result-screen').classList.contains('active'));
  if (!immediately) throw new Error('retry started immediately after game over (double input)');
  await landscape.waitForTimeout(600);
  await landscape.keyboard.press('Enter');
  const later = await landscape.evaluate(() => document.querySelector('#result-screen').classList.contains('active'));
  if (later) throw new Error('retry did not start after the short lock');

  // 回帰テスト: 共有ボタンを続けて押しても、元の文字に戻る
  await landscape.evaluate(() => {
    const btn = document.querySelector('#share-btn');
    window.__shareOriginal = btn.innerText;
    const fake = {};
    GameController.prototype.showShareFeedback.call(fake, 'A');
    GameController.prototype.showShareFeedback.call(fake, 'B');
  });
  await landscape.waitForTimeout(1800);
  const shareText = await landscape.evaluate(() => [document.querySelector('#share-btn').innerText, window.__shareOriginal]);
  if (shareText[0] !== shareText[1]) throw new Error(`share button text stuck: ${shareText.join(' / ')}`);
  await landscape.close();
  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);

  await browser.close();
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
