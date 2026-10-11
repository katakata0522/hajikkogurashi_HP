import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, resolve, join, sep } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '..');
const games = [
  ['blackhole-sweeper', '#start-btn', '#menu-btn-title'],
  ['girigiri-brake', '#start-btn', '#menu-btn-title'],
  ['kage-mane-dojo', '#startButton', '#menuButtonTitle'],
  ['mikiri-issen', '#startButton', '#titleScreen a[href="/minigames.html"]'],
  ['sorting-factory', '#start-btn', '#menu-btn-title'],
  ['stealth-slacker', '#start-btn', null],
  ['wall-jumper', '#start-btn', '#menu-btn-title'],
];
const types = new Map([['.html','text/html'],['.css','text/css'],['.js','text/javascript'],['.svg','image/svg+xml'],['.png','image/png']]);
const server = createServer((req, res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (requested.endsWith('/')) requested += 'index.html';
  const path = resolve(root, '.' + requested);
  if (!(path === root || path.startsWith(root + sep)) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'content-type': types.get(extname(path)) || 'application/octet-stream' });
  createReadStream(path).pipe(res);
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const origin = `http://127.0.0.1:${server.address().port}`;
const screenshotDir = process.env.SEVEN_MINIGAME_SCREENSHOTS;
let browser;
const failures = [];
const rect = el => {
  const r = el.getBoundingClientRect();
  return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height };
};
function inside(r, width, height) {
  return r.width > 8 && r.height > 8 && r.left >= -2 && r.top >= -2
    && r.right <= width + 2 && r.bottom <= height + 2;
}
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || chromium.executablePath() });
  for (const [width, height] of [[320,568],[390,844],[667,375],[1440,900]]) {
    for (const [slug, start, menu] of games) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width <= 430, isMobile: width <= 430 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        const response = await page.goto(`${origin}/${slug}/`, { waitUntil:'domcontentloaded' });
        assert.equal(response.status(), 200, `${slug}: game not served`);
        await page.waitForTimeout(120);
        const titleState = await page.evaluate(({start,menu}) => {
          const bounds = s => document.querySelector(s)?.getBoundingClientRect().toJSON();
          return { button:bounds(start), menu:menu?bounds(menu):null,
            scrollWidth:document.documentElement.scrollWidth };
        }, {start,menu});
        assert.ok(titleState.button && inside(titleState.button,width,height), `${slug}: start action clipped at ${width}x${height}: ${JSON.stringify(titleState)}`);
        if (menu) assert.ok(titleState.menu && inside(titleState.menu,width,height), `${slug}: return action clipped at ${width}x${height}: ${JSON.stringify(titleState)}`);
        assert.ok(titleState.scrollWidth <= width + 2, `${slug}: unwanted horizontal page scrolling`);
        if (screenshotDir) {
          const { mkdirSync } = await import('node:fs'); mkdirSync(screenshotDir, {recursive:true});
          await page.screenshot({ path: join(screenshotDir, `${slug}-${width}x${height}-title.png`), animations:'disabled' });
        }
        await page.locator(start).click();
        await page.waitForTimeout(140);
        if (slug === 'kage-mane-dojo') {
          const pad = await page.evaluate(() => [...document.querySelectorAll('#inputPad .dir-button')].map(el => el.getBoundingClientRect().toJSON()));
          assert.equal(pad.length, 4);
          assert.ok(pad.every(r => inside(r,width,height)), `Dojo input buttons are clipped at ${width}x${height}: ${JSON.stringify(pad)}`);
        }
        if (slug === 'sorting-factory') {
          const zones = await page.evaluate(() => ['#touch-left','#touch-right'].map(s => {
            const el=document.querySelector(s);return { r:el.getBoundingClientRect().toJSON(),hidden:el.classList.contains('hidden') };
          }));
          assert.ok(zones.every(z => !z.hidden && z.r.width > 20 && z.r.height > 20), 'sorting touch zones missing');
        }
        if (slug === 'mikiri-issen') assert.ok(await page.locator('#playScreen').isVisible(), 'Mikiri title remains over play');
        if (slug === 'wall-jumper') {
          await page.locator('#pause-btn').click();
          assert.ok(await page.locator('#resume-btn').isVisible(), 'pause lacks Resume');
          await page.locator('#resume-btn').click();
          assert.ok(await page.locator('#pause-btn').isVisible(), 'resume did not return to play');
        }
        if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `${slug}-${width}x${height}-playing.png`), animations:'disabled' });
        assert.deepEqual(errors, [], `${slug}: page errors at ${width}x${height}`);
      } catch (error) {
        failures.push(`${slug} ${width}x${height}: ${String(error.message||error).slice(0,400)}`);
      } finally { await page.close(); }
    }
  }
  if (failures.length) throw new Error(`seven-game device layout failures:\n${failures.join('\n')}`);
  console.log('Seven-game browser layout passed (7 games × 4 viewports; title, play, touch and pause checks)');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
