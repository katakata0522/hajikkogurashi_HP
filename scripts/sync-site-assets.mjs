import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sitePages, pageAssets } from './site-config.mjs';
import { activeElements, attributes, assetAttribute, contentVersion, validateVersionedAssets } from './test-support/versioned-assets.mjs';

const root = resolve(import.meta.dirname,'..');
const write = process.argv.includes('--write');
const readAsset = file => readFileSync(resolve(root,file));
const failures = [];
for (const page of sitePages) {
  const path = resolve(root,page);
  const source = readFileSync(path,'utf8');
  const documentUrl = new URL(page,'https://site.invalid/').href;
  let next = source;
  if (write) {
    const assets = pageAssets(page);
    const edits = activeElements(source,true).flatMap(node => {
      const attr = assetAttribute(node);
      if (!attr) return [];
      const value = attributes(node)[attr];
      const url = new URL(value,documentUrl);
      const spec = assets.find(asset => url.origin === new URL(documentUrl).origin && url.pathname === `/${asset.file}`);
      if (!spec) return [];
      const location = node.sourceCodeLocation.attrs[attr];
      return [{...location,text:`${attr}="/${spec.file}?v=${contentVersion(readAsset(spec.file))}"`}];
    }).sort((a,b) => b.startOffset-a.startOffset);
    for (const edit of edits) next = next.slice(0,edit.startOffset)+edit.text+next.slice(edit.endOffset);
  }
  try { validateVersionedAssets(next,readAsset,pageAssets(page),documentUrl); }
  catch (error) { failures.push(`${page}: ${error.message}`); continue; }
  if (write && next !== source) writeFileSync(path,next);
}
if (failures.length) throw new Error(`Asset validation failed:\n${failures.join('\n')}\nRun npm run sync:site after editing assets.`);
console.log(`content versions ${write ? 'synchronized' : 'verified'} (${sitePages.length} pages)`);
