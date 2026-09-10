import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const indexHtml = readFileSync(resolve(root, 'kanji-slicer/index.html'), 'utf8');
const schedulerSource = readFileSync(resolve(root, 'kanji-slicer/fixed-step-raf.js'), 'utf8');

const schedulerIndex = indexHtml.indexOf('src="fixed-step-raf.js"');
const gameIndex = indexHtml.indexOf('src="game.js"');
assert.ok(schedulerIndex >= 0, 'fixed-step scheduler must be loaded');
assert.ok(gameIndex > schedulerIndex, 'fixed-step scheduler must load before game.js');

const bodyStart = indexHtml.indexOf('<body>');
assert.ok(bodyStart >= 0, 'body element must exist');
const bodyHtml = indexHtml.slice(bodyStart);
assert.equal(/<meta\b/i.test(bodyHtml), false, 'SEO meta tags must not be duplicated inside body');
assert.equal(indexHtml.includes('hajikkoroom.xsrv.jp//assets/'), false, 'absolute asset URLs must not contain a double slash after host');

function simulate(nativeHz, durationMs = 1000) {
    const nativeQueue = [];
    const asyncErrors = [];
    let nativeId = 0;

    const fakeWindow = {
        requestAnimationFrame(callback) {
            nativeQueue.push(callback);
            nativeId += 1;
            return nativeId;
        },
        cancelAnimationFrame() {},
        setTimeout(callback) {
            try {
                callback();
            } catch (error) {
                asyncErrors.push(error);
            }
            return 1;
        }
    };

    vm.runInNewContext(schedulerSource, { window: fakeWindow }, { filename: 'fixed-step-raf.js' });

    assert.equal(fakeWindow.__KANJI_SLICER_FIXED_STEP__.hz, 60);
    assert.ok(Math.abs(fakeWindow.__KANJI_SLICER_FIXED_STEP__.stepMs - (1000 / 60)) < 0.001);

    let ticks = 0;
    const gameTick = () => {
        ticks += 1;
        fakeWindow.requestAnimationFrame(gameTick);
    };
    fakeWindow.requestAnimationFrame(gameTick);

    const nativeStep = 1000 / nativeHz;
    for (let timestamp = 0; timestamp <= durationMs + 0.001; timestamp += nativeStep) {
        const pump = nativeQueue.shift();
        assert.ok(pump, `native pump missing at ${nativeHz} Hz / ${timestamp} ms`);
        pump(timestamp);
    }

    assert.deepEqual(asyncErrors, []);
    return ticks;
}

const ticks30 = simulate(30);
const ticks60 = simulate(60);
const ticks120 = simulate(120);
const ticks144 = simulate(144);

for (const [hz, ticks] of [[30, ticks30], [60, ticks60], [120, ticks120], [144, ticks144]]) {
    assert.ok(ticks >= 58 && ticks <= 61, `${hz} Hz should produce about 60 simulation ticks, got ${ticks}`);
}

const allTicks = [ticks30, ticks60, ticks120, ticks144];
assert.ok(Math.max(...allTicks) - Math.min(...allTicks) <= 1, `simulation cadence diverged by refresh rate: ${allTicks.join(', ')}`);

console.log(`kanji-slicer smoke test passed (30/60/120/144 Hz => ${allTicks.join('/')})`);
