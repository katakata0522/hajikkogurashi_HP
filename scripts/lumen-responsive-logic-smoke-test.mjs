import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

// Browser-independent regression: showing the objective shortens #viewport.
// This is not a substitute for Playwright screenshot and touch checks.
const source = readFileSync(resolve(import.meta.dirname, '../lumen-mirror/script.js'), 'utf8');
let observer;
let onWindowResize;
const viewport = { clientWidth: 390, clientHeight: 620 };
const canvas = { style: {}, width: 0, height: 0 };
let resets = 0;
const ctx = { setTransform() { resets += 1; } };
const elements = new Map([
    ['viewport', viewport],
    ['stage-brief', { classList: { add() {}, remove() {} } }],
    ...['start-screen','stage-select','overlay'].map(id => [id, { classList: { add() {}, remove() {} } }]),
    ...['hud','controls'].map(id => [id, { style: {} }]),
]);
const document = { getElementById(id) { return elements.get(id); } };
const window = {
    devicePixelRatio: 2,
    addEventListener(name, callback) { if (name === 'resize') onWindowResize = callback; }
};
class ResizeObserver {
    constructor(callback) { observer = { callback, target: null }; }
    observe(target) { observer.target = target; }
}
const GameController = vm.runInNewContext(`${source}\nGameController`, {
    document, window, ResizeObserver,
    CONFIG: { WIDTH: 600, HEIGHT: 800 },
    STATE: { TITLE: 0, STAGE_SELECT: 1, PLAYING: 2 },
});
const controller = Object.create(GameController.prototype);
controller.canvas = canvas;
controller.ctx = ctx;
controller.initCanvas();
assert.equal(observer.target, viewport);
assert.equal(canvas.style.width, '390px');
assert.equal(canvas.style.height, '520px');
const initialResets = resets;
observer.callback();
assert.equal(resets, initialResets, 'unchanged size must not repeatedly reset Canvas');

viewport.clientHeight = 360;
observer.callback();
assert.equal(canvas.style.width, '270px');
assert.equal(canvas.style.height, '360px');
assert.equal(canvas.width, 1200);
assert.equal(canvas.height, 1600);
assert.equal(resets, initialResets + 1, 'shorter playfield changes Canvas geometry');

window.devicePixelRatio = 1;
onWindowResize();
assert.equal(canvas.width, 600);
assert.equal(canvas.height, 800);
viewport.clientHeight = 0;
controller.resize();
assert.equal(canvas.style.height, '360px', 'zero-size playfield must not corrupt Canvas size');

let stageLoaded = false, stageResized = false;
controller.loadStage = () => { stageLoaded = true; };
controller.resize = () => { stageResized = true; };
controller._closeInfoPanel = () => {};
controller._startStage(1);
assert.ok(stageLoaded && stageResized, 'starting a stage must recalculate available Canvas space');
console.log('lumen responsive Canvas smoke passed: observer, height, DPR, stage start');
