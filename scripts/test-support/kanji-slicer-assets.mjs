import assert from 'node:assert/strict';
import { validateVersionedAssets, verifyLiveVersionedAssets } from './versioned-assets.mjs';

export const kanjiSlicerAssets = ['style.css','fixed-step-raf.js','game.js'];
export function validateKanjiSlicerAssets(html, readAsset, documentUrl = 'https://kanji-slicer.invalid/kanji-slicer/') {
  const references = validateVersionedAssets(html,readAsset,kanjiSlicerAssets,documentUrl);
  assert.ok(references.find(ref => ref.file === 'fixed-step-raf.js').order < references.find(ref => ref.file === 'game.js').order,
    'fixed-step scheduler must load before game.js');
  return references;
}
export async function verifyLiveKanjiSlicerAssets(response, html, readAsset, fetchAsset = fetch) {
  validateKanjiSlicerAssets(html,readAsset,response.url);
  await verifyLiveVersionedAssets(response,html,readAsset,kanjiSlicerAssets,fetchAsset);
}
