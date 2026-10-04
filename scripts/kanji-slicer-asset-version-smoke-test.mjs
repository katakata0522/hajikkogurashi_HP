import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateKanjiSlicerAssets, verifyLiveKanjiSlicerAssets } from './test-support/kanji-slicer-assets.mjs';

const directory = resolve(import.meta.dirname, '../kanji-slicer');
const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
const readAsset = file => readFileSync(resolve(directory, file));
const refs = validateKanjiSlicerAssets(html, readAsset);
let checks = 0;
function reject(label, markup, reader = readAsset) {
    assert.throws(() => validateKanjiSlicerAssets(markup, reader), undefined, label);
    checks++;
}
for (const { file, digest } of refs) {
    const url = `${file}?v=${digest}`;
    const attr = file.endsWith('.css') ? 'href' : 'src';
    const tag = html.match(new RegExp(`<${file.endsWith('.css') ? 'link' : 'script'}\\b[^>]*${attr}="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>(?:</script>)?`))[0];
    reject(`${file}: file-only changes must fail`, html, name => name === file ? Buffer.concat([readAsset(name), Buffer.from('\n/* changed */')]) : readAsset(name));
    const stale = html.replace(url, file);
    reject(`${file}: correct URL in a comment cannot hide a stale reference`, `${stale}\n<!-- ${url} -->`);
    reject(`${file}: script text cannot hide a stale reference`, `${stale}\n<script>const unused = '${url}';</script>`);
    reject(`${file}: inactive template cannot satisfy a missing reference`, html.replace(tag, `<template>${tag}</template>`));
    reject(`${file}: version must be exact`, html.replace(url, `${url}dead`));
    reject(`${file}: repeated v must fail`, html.replace(url, `${url}&v=old`));
    reject(`${file}: unversioned duplicate must fail`, html.replace(tag, `${tag}\n${tag.replace(url, file)}`));
}
reject('an external base URL must not redirect asset loads', html.replace('<head>', '<head><base href="https://elsewhere.invalid/kanji-slicer/">'));
reject('disabled stylesheet must fail', html.replace('rel="stylesheet" href="style.css?', 'disabled rel="stylesheet" href="style.css?'));
reject('non-executable script must fail', html.replace('<script src="game.js?', '<script type="application/json" src="game.js?'));
reject('async scheduler must fail', html.replace('<script src="fixed-step-raf.js?', '<script async src="fixed-step-raf.js?'));
const reordered = html.replace(/(<script src="fixed-step-raf.js[^>]+><\/script>)\s*(<script src="game.js[^>]+><\/script>)/, '$2\n$1');
reject('scheduler must run before game', reordered);
// Legal formatting and inert examples must not create false failures.
validateKanjiSlicerAssets(html.replace(/(href|src)="((?:style.css|game.js|fixed-step-raf.js)[^"]+)"/g, "$1='$2'") + '\n<!-- style.css game.js -->', readAsset);
const documentResponse = { url: 'https://kanji-slicer.invalid/kanji-slicer/', headers: new Headers({ 'cache-control': 'no-cache' }) };
function assetResponse(url, { body, status = 200, type, finalUrl } = {}) {
    const file = url.pathname.split('/').pop();
    const response = new Response(body ?? readAsset(file), { status, headers: { 'content-type': type ?? (file.endsWith('.css') ? 'text/css' : 'application/javascript') } });
    Object.defineProperty(response, 'url', { value: finalUrl ?? url.href });
    return response;
}
await verifyLiveKanjiSlicerAssets(documentResponse, html, readAsset, async url => assetResponse(url));
await assert.rejects(() => verifyLiveKanjiSlicerAssets({ ...documentResponse, headers: new Headers() }, html, readAsset), /require revalidation/);
await assert.rejects(() => verifyLiveKanjiSlicerAssets(documentResponse, html, readAsset, async url => assetResponse(url, { body: 'stale cached content' })), /live bytes/);
await assert.rejects(() => verifyLiveKanjiSlicerAssets(documentResponse, html, readAsset, async url => assetResponse(url, { status: 404 })), /HTTP 200/);
await assert.rejects(() => verifyLiveKanjiSlicerAssets(documentResponse, html, readAsset, async url => assetResponse(url, { type: 'text/html' })), /MIME type/);
await assert.rejects(() => verifyLiveKanjiSlicerAssets(documentResponse, html, readAsset, async url => assetResponse(url, { finalUrl: url.origin + url.pathname })), /redirected/);
console.log(`kanji-slicer asset version regression passed (${checks} invalid HTML/content cases rejected)`);
console.log('kanji-slicer live verifier regression passed (missing revalidation, stale bytes, 404, wrong MIME, version-stripping redirects rejected)');
