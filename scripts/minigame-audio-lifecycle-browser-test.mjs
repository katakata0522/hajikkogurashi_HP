import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startStaticSiteServer } from './test-support/static-site-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '..');
const site = await startStaticSiteServer(root);
let browser;

function fail(message) {
  throw new Error(`minigame audio lifecycle: ${message}`);
}

async function setHidden(page, hidden) {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, 'hidden', { value: isHidden, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: isHidden ? 'hidden' : 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await page.waitForTimeout(150);
}

try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  // 1) 共通部品: 作られた AudioContext を見守り、隠したら止め、戻ったら再開する
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${site.origin}/blackhole-sweeper/`, { waitUntil: 'networkidle' });
  await page.click('#start-btn');
  await page.waitForTimeout(300);
  const tracked = await page.evaluate(() => {
    const lifecycle = window.__minigameAudioLifecycle;
    return lifecycle ? lifecycle.contexts.map((ctx) => ctx.state) : null;
  });
  if (!tracked || tracked.length < 1) fail(`AudioContext should be tracked after start (${JSON.stringify(tracked)})`);

  await setHidden(page, true);
  const hiddenState = await page.evaluate(() => window.__minigameAudioLifecycle.contexts[0].state);
  if (hiddenState !== 'suspended') fail(`audio should be suspended while hidden (got ${hiddenState})`);

  await setHidden(page, false);
  await page.mouse.click(10, 10);
  await page.waitForTimeout(150);
  const visibleState = await page.evaluate(() => window.__minigameAudioLifecycle.contexts[0].state);
  if (visibleState !== 'running') fail(`audio should resume after returning (got ${visibleState})`);

  // ゲームが自分で止めた（ミュート等）ものは勝手に再開しない
  await page.evaluate(() => window.__minigameAudioLifecycle.contexts[0].suspend());
  await page.waitForTimeout(100);
  await page.mouse.click(10, 10);
  await page.waitForTimeout(150);
  const keptState = await page.evaluate(() => window.__minigameAudioLifecycle.contexts[0].state);
  if (keptState !== 'suspended') fail(`game-initiated suspend must be respected (got ${keptState})`);
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await page.close();

  // 2) ウォールジャンパー: プレイ中にタブを隠したら自動で一時停止
  const wj = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const wjErrors = [];
  wj.on('pageerror', (error) => wjErrors.push(error.message));
  await wj.goto(`${site.origin}/wall-jumper/`, { waitUntil: 'networkidle' });
  await wj.click('#start-btn');
  await wj.waitForTimeout(400);
  await setHidden(wj, true);
  const paused = await wj.evaluate(() => getComputedStyle(document.getElementById('pause-screen')).display);
  if (paused !== 'flex') fail(`wall-jumper should show the pause screen after the tab is hidden (display=${paused})`);
  if (wjErrors.length) fail(`wall-jumper page errors: ${wjErrors.join(' | ')}`);
  await wj.close();

  console.log('minigame audio lifecycle browser test passed');
} finally {
  await browser?.close();
  await site.close?.();
}
