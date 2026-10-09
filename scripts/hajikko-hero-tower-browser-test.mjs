import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startStaticSiteServer } from './test-support/static-site-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '..');
const site = await startStaticSiteServer(root);
let browser;

async function checkBoard(page, label) {
  const result = await page.evaluate(() => {
    const panels = [...document.querySelectorAll('#grid-container > .grid-panel')];
    const grid = document.querySelector('#grid-container').getBoundingClientRect();
    const iconsOutside = [];
    for (const panel of panels) {
      const svg = panel.querySelector('.panel-icon svg');
      if (!svg || getComputedStyle(svg).display === 'none') continue;
      const p = panel.getBoundingClientRect();
      const s = svg.getBoundingClientRect();
      if (s.top < p.top - 1 || s.bottom > p.bottom + 1 || s.left < p.left - 1 || s.right > p.right + 1) {
        iconsOutside.push(panel.dataset.index);
      }
    }
    return {
      count: panels.length,
      gridWidth: Math.round(grid.width),
      gridHeight: Math.round(grid.height),
      gridBottom: Math.round(grid.bottom),
      viewportHeight: window.innerHeight,
      iconsOutside,
    };
  });
  if (result.count !== 25) throw new Error(`${label}: expected 25 panels, got ${JSON.stringify(result)}`);
  if (result.gridHeight < 150) throw new Error(`${label}: board is too small: ${JSON.stringify(result)}`);
  if (Math.abs(result.gridWidth - result.gridHeight) > 4) throw new Error(`${label}: board should be square: ${JSON.stringify(result)}`);
  if (result.gridBottom > result.viewportHeight) throw new Error(`${label}: board bottom is off-screen: ${JSON.stringify(result)}`);
  if (result.iconsOutside.length) throw new Error(`${label}: icons overflow their panels: ${JSON.stringify(result)}`);
}

try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
  });

  for (const viewport of [{ width: 390, height: 844, mobile: true }, { width: 1280, height: 800, mobile: false }]) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${site.origin}/hajikko-hero-tower/`, { waitUntil: 'networkidle' });
    await page.dblclick('#start-play-btn');
    await page.waitForTimeout(1500);
    await checkBoard(page, label);

    // 長押しのキーリピートで画面が進まないこと（エラーが出ないこと）
    await page.keyboard.down('Space');
    for (let i = 0; i < 5; i += 1) await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await page.waitForTimeout(200);

    if (errors.length) throw new Error(`${label}: page errors: ${errors.join(' | ')}`);
    await context.close();
  }

  // 保存領域が使えない環境でも止まらないこと
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('blocked getItem'); }, configurable: true });
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new Error('blocked setItem'); }, configurable: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${site.origin}/hajikko-hero-tower/`, { waitUntil: 'networkidle' });
  await page.click('#start-play-btn');
  await page.waitForTimeout(1200);
  await checkBoard(page, 'storage-blocked');
  if (errors.length) throw new Error(`storage-blocked: page errors: ${errors.join(' | ')}`);
  await context.close();

  console.log('hajikko-hero-tower browser test passed');
} finally {
  await browser?.close();
  await site.close?.();
}
