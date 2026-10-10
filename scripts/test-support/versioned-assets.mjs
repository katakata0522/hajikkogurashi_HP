import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

export const contentVersion = bytes => createHash('sha256').update(bytes).digest('hex').slice(0,12);
export function activeElements(html, withLocations = false) {
  const elements = [];
  function visit(node) {
    if (node.tagName && node.namespaceURI === 'http://www.w3.org/1999/xhtml') elements.push(node);
    for (const child of node.childNodes || []) visit(child);
  }
  // Template content, comments and script text do not load page assets.
  visit(parse(html, { sourceCodeLocationInfo: withLocations }));
  return elements;
}
export const attributes = node => Object.fromEntries(node.attrs.map(({name,value}) => [name,value]));
export function assetAttribute(node) {
  const attrs = attributes(node);
  if (node.tagName === 'script' && 'src' in attrs) return 'src';
  if (node.tagName === 'link' && attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet')) return 'href';
  return null;
}
export function validateVersionedAssets(html, readAsset, assets, documentUrl) {
  const elements = activeElements(html);
  const base = elements.find(node => node.tagName === 'base' && 'href' in attributes(node));
  const baseUrl = base ? new URL(attributes(base).href, documentUrl) : new URL(documentUrl);
  return assets.map(spec => {
    const {file,execution = 'ordered'} = typeof spec === 'string' ? {file:spec} : spec;
    const expectedUrl = new URL(file, documentUrl);
    const candidates = elements.flatMap((node,order) => {
      const attr = assetAttribute(node);
      if (!attr) return [];
      const attrs = attributes(node);
      const url = new URL(attrs[attr], baseUrl);
      return url.pathname === expectedUrl.pathname ? [{node,attrs,url,order}] : [];
    });
    assert.equal(candidates.length,1,`${file} must have exactly one active asset reference`);
    const {node,attrs,url,order} = candidates[0];
    assert.equal(url.origin,expectedUrl.origin,`${file} must load from this site`);
    const digest = contentVersion(readAsset(file));
    assert.equal(url.search,`?v=${digest}`,`${file} must use its exact current content version`);
    assert.equal(url.hash,'',`${file} must not have a fragment`);
    if (file.endsWith('.css')) {
      assert.equal(node.tagName,'link',`${file} must be a stylesheet`);
      assert.equal('disabled' in attrs,false,`${file} must be enabled`);
      assert.equal(attrs.rel.toLowerCase().split(/\s+/).includes('alternate'),false,`${file} must not be alternate`);
      assert.ok(['','all'].includes((attrs.media || '').trim().toLowerCase()),`${file} must apply to the screen`);
    } else {
      assert.equal(node.tagName,'script',`${file} must be a script`);
      assert.ok(['','text/javascript','application/javascript'].includes((attrs.type || '').trim().toLowerCase()),`${file} must be executable classic JavaScript`);
      for (const flag of ['async','nomodule']) assert.equal(flag in attrs,false,`${file} must execute in document order`);
      assert.equal('defer' in attrs,execution === 'defer',`${file} must use ${execution} execution`);
    }
    return {file,url,digest,order};
  });
}
export async function verifyLiveVersionedAssets(response, html, readAsset, assets, fetchAsset = fetch) {
  const policy = (response.headers.get('cache-control') || '').toLowerCase().split(',').map(value => value.trim());
  assert.ok(policy.includes('no-cache') || policy.includes('no-store'),'HTML must require revalidation');
  const references = validateVersionedAssets(html,readAsset,assets,response.url);
  for (const {file,url} of references) {
    const asset = await fetchAsset(url,{signal:AbortSignal.timeout(10_000),redirect:'follow'});
    assert.equal(asset.status,200,`${file}: live asset must return HTTP 200`);
    assert.equal(asset.url,url.href,`${file}: live asset URL/version must not be redirected`);
    const type = (asset.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    assert.ok((file.endsWith('.css') ? ['text/css'] : ['application/javascript','text/javascript']).includes(type),`${file}: unexpected live MIME type ${type}`);
    const actual = createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex');
    const expected = createHash('sha256').update(readAsset(file)).digest('hex');
    assert.equal(actual,expected,`${file}: live bytes must match the deployed source, including when served from a cache`);
  }
}
