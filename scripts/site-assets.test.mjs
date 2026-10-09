import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { sitePages, pageAssets } from './site-config.mjs';
import { activeElements, attributes, validateVersionedAssets, verifyLiveVersionedAssets } from './test-support/versioned-assets.mjs';

const root = resolve(import.meta.dirname,'..');
const read = file => readFileSync(resolve(root,file));
for (const page of sitePages) test(`${page}: all managed asset URLs match original content bytes`, () => {
  const html = read(page).toString();
  const specs = pageAssets(page);
  const url = new URL(page,'https://site.invalid/').href;
  const references = validateVersionedAssets(html,read,specs,url);
  for (const {file} of references) {
    assert.throws(() => validateVersionedAssets(html,asset => asset === file ? Buffer.concat([read(asset),Buffer.from('changed')]) : read(asset),specs,url),/current content version/);
  }
  assert.doesNotMatch(html,/filemtime|\/assets\/js\/home-v2\.js/);
});

test('inactive examples, duplicate/stale URLs and non-executable tags cannot satisfy the gate', () => {
  const html = read('index.html').toString(),specs = pageAssets('index.html'),url = 'https://site.invalid/';
  const refs = validateVersionedAssets(html,read,specs,url);
  for (const {file,digest} of refs) {
    const current = `/${file}?v=${digest}`;
    const tag = html.match(new RegExp(`<${file.endsWith('.css') ? 'link' : 'script'}\\b[^>]*(?:href|src)="${current.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[^>]*>(?:</script>)?`))[0];
    const stale = html.replace(current,`/${file}`);
    for (const fake of [`<!-- ${tag} -->`,`<template>${tag}</template>`,`<script>const example=${JSON.stringify(current)}</script>`]) {
      assert.throws(() => validateVersionedAssets(stale+fake,read,specs,url));
    }
    for (const suffix of ['dead','&v=old','#fragment']) assert.throws(() => validateVersionedAssets(html.replace(current,current+suffix),read,specs,url));
    assert.throws(() => validateVersionedAssets(html.replace(tag,tag+tag.replace(current,`/${file}`)),read,specs,url));
  }
  assert.throws(() => validateVersionedAssets(html.replace('<head>','<head><base href="https://elsewhere.invalid/">'),read,specs,url));
  assert.throws(() => validateVersionedAssets(html.replace('<link rel="stylesheet"','<link disabled rel="stylesheet"'),read,specs,url));
  assert.throws(() => validateVersionedAssets(html.replace('<script defer src=','<script async src='),read,specs,url));
});

test('every root page has a single accessible shared navigation and valid local routes', () => {
  for (const page of sitePages) {
    const nodes = activeElements(read(page).toString());
    const ids = nodes.map(attributes).map(attrs => attrs.id).filter(Boolean);
    assert.equal(ids.length,new Set(ids).size,`${page}: duplicate ids`);
    assert.equal(ids.filter(id => id === 'site-header').length,1);
    assert.equal(ids.filter(id => id === 'mobile-menu').length,1);
    assert.ok(!ids.includes('menu'),`${page}: legacy menu must not compete for input`);
    for (const node of nodes.filter(node => node.tagName === 'a')) {
      const href = attributes(node).href;
      if (!href || /^(https?:|mailto:|data:)/.test(href)) continue;
      const target = new URL(href,new URL(page,'https://site.invalid/'));
      const targetPage = target.pathname.endsWith('/') ? target.pathname.slice(1)+'index.html' : target.pathname.slice(1);
      const destination = read(targetPage).toString();
      if (target.hash) assert.ok(activeElements(destination).some(element => attributes(element).id === decodeURIComponent(target.hash.slice(1))),`${page}: broken ${href}`);
    }
  }
});

test('the live verifier rejects cache, MIME, redirect and stale-content failures', async () => {
  const html = read('index.html').toString(),specs = pageAssets('index.html');
  const response = {url:'https://site.invalid/',headers:new Headers({'cache-control':'no-cache'})};
  function asset(url,override={}) {
    const file = url.pathname.slice(1);
    const result = new Response(override.body ?? read(file),{status:override.status ?? 200,headers:{'content-type':override.type ?? (file.endsWith('.css') ? 'text/css' : 'text/javascript')}});
    Object.defineProperty(result,'url',{value:override.url ?? url.href});
    return result;
  }
  await verifyLiveVersionedAssets(response,html,read,specs,async url => asset(url));
  await assert.rejects(() => verifyLiveVersionedAssets({...response,headers:new Headers()},html,read,specs),/revalidation/);
  for (const bad of [{body:'old cache'},{status:404},{type:'text/html'},{url:'https://site.invalid/stripped.css'}]) {
    await assert.rejects(() => verifyLiveVersionedAssets(response,html,read,specs,async url => asset(url,bad)));
  }
});
