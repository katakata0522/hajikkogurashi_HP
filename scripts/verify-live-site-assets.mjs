import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sitePages, pageAssets } from './site-config.mjs';
import { verifyLiveVersionedAssets } from './test-support/versioned-assets.mjs';

const root = resolve(import.meta.dirname,'..');
const base = new URL(process.argv[2] || 'https://hajikkoroom.xsrv.jp/');
// A real 404 response is correct for 404.html on some servers; it is covered locally.
for (const page of sitePages.filter(page => page !== '404.html')) {
  const routes = page === 'index.html' ? ['',page] : [page];
  for (const route of routes) {
    // Normal URLs: cache-bypassing query strings would hide this failure.
    const response = await fetch(new URL(route,base),{signal:AbortSignal.timeout(10_000),redirect:'follow'});
    assert.equal(response.status,200,`${route || '/'}: HTML must return 200`);
    assert.match(response.headers.get('content-type') || '',/text\/html/i);
    const html = await response.text();
    await verifyLiveVersionedAssets(response,html,file => readFileSync(resolve(root,file)),pageAssets(page));
    console.log(`live site assets verified: ${route || '/'}`);
  }
}
