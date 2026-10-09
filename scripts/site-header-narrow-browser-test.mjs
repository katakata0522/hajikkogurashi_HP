import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startStaticSiteServer } from './test-support/static-site-server.mjs';

// 回帰テスト: 幅 320〜375px のスマホで、ヘッダーの MENU ボタンが画面の右端からはみ出さない
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '..');
const site = await startStaticSiteServer(root);
const pages = ['index.html', 'aboutus.html', 'members.html', 'minigames.html', 'news.html', 'portfolio.html',
  'coming-soon.html', 'privacy-policy.html', 'terms-of-service.html', '404.html'];
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const failures = [];
  for (const width of [320, 360, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 640 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    for (const path of pages) {
      await page.goto(`${site.origin}/${path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const box = await page.evaluate(() => {
        const menu = document.querySelector('#header nav a[href="#menu"]');
        const logo = document.querySelector('#header .logo');
        if (!menu || !logo) return null;
        const m = menu.getBoundingClientRect();
        const l = logo.getBoundingClientRect();
        return { menuLeft: m.left, menuRight: m.right, logoRight: l.right, viewport: innerWidth };
      });
      if (!box) { failures.push(`${path} @${width}: header MENU/logo not found`); continue; }
      if (box.menuRight > box.viewport + 0.5 || box.menuLeft < box.logoRight - 0.5) {
        failures.push(`${path} @${width}: MENU button does not fit beside the logo: ${JSON.stringify(box)}`);
      }
    }
    await context.close();
  }
  if (failures.length) throw new Error(`header narrow-width failures:\n- ${failures.join('\n- ')}`);
  console.log('site header narrow-width browser test passed');
} finally {
  await browser?.close();
  await site.close?.();
}
