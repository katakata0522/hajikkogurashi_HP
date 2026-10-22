// メールアプリを起動せず、旧ページの連絡導線と試作版からの遷移を検証する。
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startStaticSiteServer } from './test-support/static-site-server.mjs';

const server = await startStaticSiteServer(resolve(import.meta.dirname, '..'));
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || chromium.executablePath() });
  let cases = 0;
  for (const width of [320, 390, 1365]) {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, javaScriptEnabled, reducedMotion: 'reduce' });
      await context.route('**/*', route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${server.origin}/index_legacy.html`, { waitUntil: 'networkidle' });
      const action = page.getByRole('link', { name: 'メールアプリを開く', exact: true });
      assert.equal(await action.count(), 1);
      assert.equal(await action.getAttribute('href'), 'mailto:hajikkogurashi.official@gmail.com');
      assert.equal(await page.locator('form').count(), 0, 'Retired form must not collect messages');
      const address = page.getByRole('link', { name: 'hajikkogurashi.official@gmail.com', exact: true });
      assert.equal(await address.getAttribute('href'), 'mailto:hajikkogurashi.official@gmail.com');
      await action.scrollIntoViewIfNeeded();
      const box = await action.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 845,
        `Mail action clipped at width=${width}, JavaScript=${javaScriptEnabled}: ${JSON.stringify(box)}`);
      assert.ok(await action.evaluate(el => {
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return hit === el || el.contains(hit);
      }), 'Another element covers the mail action');
      assert.ok(await page.locator('#contact').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Contact content overflows');
      assert.deepEqual(errors, []);
      await context.close();
      cases++;
    }
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/*', route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
  await page.goto(`${server.origin}/concept/`, { waitUntil: 'networkidle' });
  const contact = page.getByRole('link', { name: 'お問い合わせ', exact: true });
  assert.equal(await contact.getAttribute('href'), '/#dispatch');
  await contact.click();
  await page.waitForURL(`${server.origin}/#dispatch`);
  assert.equal(await page.locator('#dispatch').count(), 1);
  assert.equal(await page.getByRole('link', { name: /メールアプリを起動して連絡する/ }).getAttribute('href'), 'mailto:hajikkogurashi.official@gmail.com');
  console.log(`Mail contact browser: ${cases} viewport/script cases and concept-to-contact navigation passed`);
} finally {
  await browser?.close();
  await server.close();
}
