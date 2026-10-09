import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'hajikko-hero-tower', 'index.html'), 'utf8');
const script = readFileSync(resolve(root, 'hajikko-hero-tower', 'game.js'), 'utf8');
const style = readFileSync(resolve(root, 'hajikko-hero-tower', 'style.css'), 'utf8');

assert.doesNotThrow(() => new vm.Script(script), 'game.js must be valid JavaScript');

// ページ情報（公開一覧に載せたので他のゲームと同じ形にそろえる）
assert.ok(/<title>はじっこ勇者のインフレ魔塔 \| Corner Neighbor<\/title>/.test(html), 'title should use the in-game title and site name');
assert.ok(!/hajikkogurashi HP/.test(html), 'old placeholder site name must not remain');
assert.ok(/<link rel="canonical" href="https:\/\/hajikkoroom\.xsrv\.jp\/hajikko-hero-tower\/">/.test(html), 'canonical URL should be set');
assert.ok(/<meta property="og:image" content="https:\/\/hajikkoroom\.xsrv\.jp\/assets\/images\/hajikko_hero_tower_thumbnail\.png">/.test(html), 'og:image should point at the thumbnail');
assert.ok(/id="start-overlay"/.test(html), 'start overlay should be present');
assert.ok(/id="start-play-btn"/.test(html), 'start button should be present');
assert.ok(/id="grid-container"/.test(html), 'grid container should be present');

// 開始直後に止まっていた不具合（Proxy を structuredClone できない）の再発防止
assert.ok(!/structuredClone\((?!raw\))/.test(script), 'structuredClone must only be used on proxy-free data inside cloneData (it throws on Proxy state)');
assert.ok(/function cloneData\(/.test(script), 'proxy-safe deep clone helper should exist');

// 開始ボタンの連打で二重にゲームループが動かないこと
assert.ok(/if \(gameStarted\) return;/.test(script), 'start handler should ignore repeated clicks');

// キー押しっぱなしで画面が進まないこと
assert.ok(/if \(e\.repeat\) return;/.test(script), 'keyboard handler should ignore auto-repeat');

// マスのアイコンがはみ出さないよう、SVG に viewBox を付けて作る
assert.ok(/<svg viewBox="0 0 24 24"[^>]*><use href=""><\/use><\/svg>/.test(script), 'grid icons must be created with a viewBox');
assert.ok(/\.grid-panel \.panel-icon svg\s*\{[^}]*height:\s*100%/.test(style), 'grid icon svg should be sized to its slot');
assert.ok(/#grid-container\s*\{[^}]*min\(100cqw, 100cqh\)/.test(style), 'board should stay square inside its area');

console.log('hajikko-hero-tower smoke test passed');
