import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { validateKanjiSlicerAssets, verifyLiveKanjiSlicerAssets } from './test-support/kanji-slicer-assets.mjs';

const directory = resolve(import.meta.dirname, '../kanji-slicer');
const readAsset = file => readFileSync(resolve(directory, file));
const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
const references = validateKanjiSlicerAssets(html, readAsset);
const oldHtml = references.reduce((text, { file, digest }) => text.replace(`${file}?v=${digest}`, file), html);
const oldCss = 'body { margin: 0 } #game-header { height: 76px; min-height: 76px } #game-footer { display: none }';
let published = false;
const requests = [];
const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    requests.push({ url: url.pathname + url.search, published });
    if (url.pathname === '/blank.html') {
        res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
        res.end('<!doctype html><title>Between visits</title>');
    } else if (['/kanji-slicer/', '/kanji-slicer/index.html'].includes(url.pathname)) {
        res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' });
        res.end(published ? html : oldHtml);
    } else {
        const file = url.pathname.split('/').pop();
        const reference = references.find(item => item.file === file);
        if (!reference || url.pathname !== `/kanji-slicer/${file}`) {
            res.writeHead(404); res.end(); return;
        }
        res.writeHead(200, {
            'content-type': file.endsWith('.css') ? 'text/css' : 'application/javascript',
            'cache-control': 'max-age=604800',
        });
        const current = published || url.search === `?v=${reference.digest}`;
        res.end(current ? readAsset(file) : file.endsWith('.css') ? oldCss : 'window.__preReleaseAsset = true;');
    }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || chromium.executablePath() });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/kanji-slicer/`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#game-footer').isVisible(), false, 'fixture must reproduce the hidden footer');
    assert.equal(await page.locator('#game-header').evaluate(el => el.getBoundingClientRect().height), 76);
    await page.evaluate(() => {
        localStorage.setItem('kanjislicer_best', '123');
        localStorage.setItem('kanjislicer_discovered', JSON.stringify(['火山']));
    });
    // Keep the same browser/context and its HTTP cache. No routing, cache
    // clearing, CDP cache disabling, or hard reload is used in this test.
    await page.goto(`${origin}/blank.html`);
    published = true;
    await page.goto(`${origin}/kanji-slicer/`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#game-footer').isVisible(), true);
    assert.ok(await page.locator('#game-header').evaluate(el => el.getBoundingClientRect().height >= 106));
    assert.equal(await page.locator('#best-score').textContent(), '123', 'returning player record must survive');
    assert.equal(await page.evaluate(() => discoveredKanji.includes('火山')), true);
    assert.equal(await page.evaluate(() => window.__preReleaseAsset), undefined, 'cached old JS must not execute');
    assert.equal(await page.evaluate(() => window.__KANJI_SLICER_FIXED_STEP__.hz), 60);
    assert.deepEqual(errors, []);
    for (const { file, digest } of references) {
        assert.ok(requests.some(req => req.published && req.url === `/kanji-slicer/${file}?v=${digest}`), `${file}: new URL must be requested`);
        assert.equal(requests.some(req => req.published && req.url === `/kanji-slicer/${file}`), false, `${file}: no fallback to old URL`);
    }
    const stillCached = await page.evaluate(async () => (await fetch('style.css')).text());
    assert.equal(stillCached, oldCss, 'old unversioned CSS must still be in cache, so the test cannot pass through cache clearing');
    assert.equal(requests.some(req => req.published && req.url === '/kanji-slicer/style.css'), false);
    await page.locator('#btn-pause').click();
    await page.locator('#btn-resume').click();
    assert.equal(await page.evaluate(() => isPaused), false);
    // Exercise the production live verifier against real HTTP responses too.
    const response = await fetch(`${origin}/kanji-slicer/`);
    await verifyLiveKanjiSlicerAssets(response, await response.text(), readAsset);
    console.log('kanji-slicer returning-player cache regression passed: old assets retained, new URLs loaded, layout and saved progress restored');
} finally {
    await browser?.close();
    await new Promise(resolveClose => server.close(resolveClose));
}
