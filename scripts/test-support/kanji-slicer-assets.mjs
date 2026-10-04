import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

export const kanjiSlicerAssets = ['style.css', 'fixed-step-raf.js', 'game.js'];

// Use the HTML parser's active document tree: comments, script text and
// template contents are not asset references. Hash original file bytes.
export function validateKanjiSlicerAssets(html, readAsset, documentUrl = 'https://kanji-slicer.invalid/kanji-slicer/') {
    const elements = [];
    function visit(node) {
        if (node.tagName && node.namespaceURI === 'http://www.w3.org/1999/xhtml') elements.push(node);
        for (const child of node.childNodes || []) visit(child);
    }
    visit(parse(html));
    const attrs = node => Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
    const base = elements.find(node => node.tagName === 'base' && 'href' in attrs(node));
    const baseUrl = base ? new URL(attrs(base).href, documentUrl) : new URL(documentUrl);
    const references = kanjiSlicerAssets.map(file => {
        const expectedUrl = new URL(file, documentUrl);
        const candidates = elements.flatMap((node, order) => {
            const attributes = attrs(node);
            const source = node.tagName === 'script' ? attributes.src
                : node.tagName === 'link' && attributes.rel?.toLowerCase().split(/\s+/).includes('stylesheet') ? attributes.href : undefined;
            if (source === undefined) return [];
            const url = new URL(source, baseUrl);
            return url.pathname === expectedUrl.pathname ? [{ node, attributes, url, order }] : [];
        });
        assert.equal(candidates.length, 1, `${file} must have exactly one active asset reference`);
        const { node, attributes, url, order } = candidates[0];
        assert.equal(url.origin, expectedUrl.origin, `${file} must load from this site`);
        const digest = createHash('sha256').update(readAsset(file)).digest('hex').slice(0, 12);
        assert.equal(url.search, `?v=${digest}`, `${file} must use its exact current content version`);
        assert.equal(url.hash, '', `${file} must not have a fragment`);
        if (file.endsWith('.css')) {
            assert.equal(node.tagName, 'link', `${file} must be a stylesheet`);
            assert.equal('disabled' in attributes, false, `${file} must be enabled`);
            assert.equal(attributes.rel.toLowerCase().split(/\s+/).includes('alternate'), false, `${file} must not be alternate`);
            assert.ok(['', 'all'].includes((attributes.media || '').trim().toLowerCase()), `${file} must apply to the game screen`);
        } else {
            assert.equal(node.tagName, 'script', `${file} must be a script`);
            assert.ok(['', 'text/javascript', 'application/javascript'].includes((attributes.type || '').trim().toLowerCase()), `${file} must be executable classic JavaScript`);
            for (const flag of ['async', 'defer', 'nomodule']) {
                assert.equal(flag in attributes, false, `${file} must execute in document order`);
            }
        }
        return { file, url, digest, order };
    });
    assert.ok(references.find(ref => ref.file === 'fixed-step-raf.js').order < references.find(ref => ref.file === 'game.js').order,
        'fixed-step scheduler must load before game.js');
    return references;
}

export async function verifyLiveKanjiSlicerAssets(response, html, readAsset, fetchAsset = fetch) {
    const policy = (response.headers.get('cache-control') || '').toLowerCase().split(',').map(value => value.trim());
    assert.ok(policy.includes('no-cache') || policy.includes('no-store'), 'kanji-slicer HTML must require revalidation');
    const references = validateKanjiSlicerAssets(html, readAsset, response.url);
    for (const { file, url } of references) {
        const asset = await fetchAsset(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
        assert.equal(asset.status, 200, `${file}: live asset must return HTTP 200`);
        assert.equal(asset.url, url.href, `${file}: live asset URL/version must not be redirected`);
        const type = (asset.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        assert.ok((file.endsWith('.css') ? ['text/css'] : ['application/javascript', 'text/javascript']).includes(type), `${file}: unexpected live MIME type ${type}`);
        const actual = createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex');
        const expected = createHash('sha256').update(readAsset(file)).digest('hex');
        assert.equal(actual, expected, `${file}: live bytes must match the deployed source, including when served from a cache`);
    }
}
