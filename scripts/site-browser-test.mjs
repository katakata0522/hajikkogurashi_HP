// 共通ナビの動作テスト（PR #52 の scripts/site-browser-test.mjs をこのブランチ用に調整）
// - トップは PR #52 の新トップではなくこのブランチのトップなので、#about の代わりに #contact で確認
// - 本文へスキップは1つだけ、メニューを開いている間は背景（バナー・お問い合わせ欄・ページトップボタン含む）を操作できないこと
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { sitePages } from './site-config.mjs';
import { startStaticSiteServer } from './test-support/static-site-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '..');
const site = await startStaticSiteServer(root);
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const failures = [];
let views = 0;
const dimensions = [320, 375, 390, 768, 1024, 1440];
// かたかたさんが決めたメニューの言葉と順番（お知らせ＝news.html はメニューに入れない）
const menuLabels = ['私たちについて', '作品一覧', 'いますぐあそぶ！', 'メンバー', '鋭意制作中！', 'お問い合わせ'];
const navPages = ['aboutus', 'portfolio', 'minigames', 'members', 'coming-soon'];
// テスト用サーバーは PHP を実行しないので、トップのお問い合わせ欄（PHP の include）を HTML 部分だけ差し込んで再現する
const contactSection = readFileSync(resolve(root, 'includes/contact-section.php'), 'utf8').replace(/<\?php[\s\S]*?\?>/g, '');
async function withContactSection(page) {
  await page.route(url => new URL(url).pathname === '/' || new URL(url).pathname === '/index.html', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/<\?php\s+include\s+'includes\/contact-section\.php';\s*\?>/, contactSection);
    await route.fulfill({ response, body });
  });
}
async function visit(page, url) {
  const response = await page.goto(site.origin + url, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.evaluate(() => document.fonts.ready);
}
try {
  for (const width of dimensions) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await withContactSection(page);
    page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(site.origin) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    for (const route of ['/', ...sitePages.filter(name => name !== 'index.html').map(name => '/' + name)]) {
      try {
        await visit(page, route); views++;
        const layout = await page.evaluate(() => {
          const header = document.querySelector('.site-header');
          const toggle = document.querySelector('.menu-toggle');
          return {
            scroll: document.documentElement.scrollWidth,
            header: header.getBoundingClientRect().toJSON(),
            toggleRight: toggle.getBoundingClientRect().right,
            h1: document.querySelectorAll('h1').length,
            skipLinks: document.querySelectorAll('.skip-link').length,
            oldMenu: !!document.querySelector('#menu, #header'),
          };
        });
        assert.ok(layout.scroll <= width + 1, `${route} ${width}: horizontal overflow ${layout.scroll}`);
        assert.equal(layout.h1, 1, `${route}: one H1`);
        assert.equal(layout.skipLinks, 1, `${route}: exactly one skip link`);
        assert.equal(layout.oldMenu, false, `${route}: old header/menu must be gone`);
        const labels = await page.evaluate(() => ({
          mobile: [...document.querySelectorAll('.mobile-menu-inner > a')].map(a => a.textContent.replace(/^\s*\d+\s*/, '').trim()),
          desktop: [...document.querySelectorAll('.desktop-nav a')].map(a => a.textContent.trim()),
          play: document.querySelector('.header-play').textContent.trim(),
          subtitle: document.querySelector('.brand-name small').textContent.trim(),
        }));
        const expectedMobile = [...(route === '/' ? [] : ['ホームへ']), ...menuLabels];
        assert.deepEqual(labels.mobile, expectedMobile, `${route}: mobile menu labels/order`);
        assert.deepEqual(labels.desktop, ['私たちについて', '作品一覧', 'メンバー', '鋭意制作中！'], `${route}: desktop nav labels/order`);
        assert.equal(labels.play, 'いますぐあそぶ！ ↗', `${route}: CTA wording`);
        assert.equal(labels.subtitle, 'まったりゲームを作るサークル！', `${route}: original logo subtitle`);
        assert.ok(layout.header.height >= 60 && layout.header.height <= 85, `${route}: header height ${layout.header.height}`);
        assert.ok(layout.toggleRight <= width + 0.5, `${route}: menu button clipped ${layout.toggleRight}`);
        if (width < 861) {
          await page.locator('.menu-toggle').click();
          await page.waitForFunction(() => document.querySelector('.mobile-menu').contains(document.activeElement)).catch(error => { throw new Error('opening menu focus: ' + error.message); });
          const inertState = await page.evaluate(() => ({
            main: document.querySelector('main').inert,
            footer: document.querySelector('footer').inert,
            skip: document.querySelector('.skip-link').closest('[inert]') !== null,
            others: ['#banner', '#contact', '#scrollToTopBtn'].map(sel => document.querySelector(sel)).filter(Boolean).every(el => el.closest('[inert]') !== null),
            menu: document.querySelector('.mobile-menu').inert,
          }));
          assert.deepEqual(inertState, { main: true, footer: true, skip: true, others: true, menu: false }, `${route}: background must be inert while menu is open`);
          await page.locator('.mobile-menu a').last().focus(); await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-toggle');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.mobile-menu a:last-of-type')), true);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
          assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-toggle');
          assert.equal(await page.locator('main').evaluate(element => element.inert), false);
          if (route === '/') {
            await page.locator('.menu-toggle').click();
            await page.locator('.mobile-menu a[href="#contact"]').click();
            await page.waitForFunction(() => location.hash === '#contact').catch(error => { throw new Error('contact anchor navigation: ' + error.message); });
            assert.equal(await page.evaluate(() => document.activeElement.id), 'contact');
            assert.ok(await page.locator('#contact').evaluate(element => element.getBoundingClientRect().top) >= 60, 'anchor must clear the sticky header');
          } else if (navPages.some(name => route === `/${name}.html`)) {
            assert.equal(await page.locator('.mobile-menu a[aria-current="page"]').count(), 1);
          } else if (route === '/news.html') {
            // お知らせはメニューに無いので、どの項目も強調しない（メニュー自体は表示する）
            assert.equal(await page.locator('.mobile-menu a[aria-current="page"]').count(), 0, 'news: no menu item highlighted');
          }
        } else {
          const current = await page.locator('.desktop-nav a[aria-current="page"], .header-play[aria-current="page"]').count();
          if (navPages.some(name => route === `/${name}.html`)) assert.equal(current, 1, `${route}: current page marked in desktop nav`);
          if (route === '/news.html') assert.equal(current, 0, 'news: no nav item highlighted');
        }
      } catch (error) { failures.push(`${width}px ${route}: ${error.message}`); }
    }
    if (errors.length) failures.push(`${width}px browser errors: ${errors.join(' | ')}`);
    await context.close();
  }
  // 短い画面: メニューの最後まで届く・閉じるとスクロール位置が戻る・PC幅に広げると閉じる
  const page = await browser.newPage({ viewport: { width: 390, height: 320 }, reducedMotion: 'reduce' });
  await withContactSection(page);
  await visit(page, '/');
  await page.evaluate(() => window.scrollTo(0, 500));
  const originalScroll = await page.evaluate(() => scrollY);
  await page.locator('.menu-toggle').focus(); await page.keyboard.press('Enter');
  await page.locator('.mobile-menu a[href="#contact"]').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('.mobile-menu a[href="#contact"]').isVisible(), 'contact reachable in short viewport');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => scrollY), originalScroll, 'close restores scroll exactly');
  await page.locator('.menu-toggle').click(); await page.setViewportSize({ width: 1024, height: 768 });
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'brand');
  assert.equal(await page.locator('main').evaluate(element => element.inert), false);
  await page.close();
  // スマホでメニューからページを移動できる
  const journey = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await journey.route('https://fonts.googleapis.com/**', route => route.abort());
  await visit(journey, '/');
  for (const [href, check] of [['/members.html', async () => assert.equal(await journey.locator('.member-card').count(), 7, 'all existing member profiles remain available')],
    ['/minigames.html', async () => assert.ok(await journey.locator('a[href="/kanji-slicer/"]').count() > 0, 'game catalog destination retained')],
    ['/', async () => assert.ok(await journey.locator('#banner').count() === 1, 'home reachable from 00 ホームへ')]]) {
    await journey.locator('.menu-toggle').click();
    await journey.locator(`.mobile-menu a[href="${href}"]`).click();
    await journey.waitForURL(site.origin + href);
    await check();
  }
  await journey.close();
  // JavaScript なしでも本文とページへのリンクは使える
  const noJs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await visit(noJs, '/'); assert.ok(await noJs.locator('h1').isVisible()); assert.ok(await noJs.locator('a[href="/portfolio.html"]').count() >= 1); await noJs.close();
  assert.deepEqual(failures, []);
  console.log(`site browser regression passed (${views} views; focus, menu, anchors, resize, short viewport, no-JS content)`);
} finally { await browser.close(); await site.close(); }
