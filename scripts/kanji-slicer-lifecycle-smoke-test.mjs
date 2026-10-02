import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

// Execute the real game logic with a small DOM fixture. This checks state and
// input lifecycles; actual layout, rendering, and audio still require a browser.
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'kanji-slicer/game.js'), 'utf8');
const markup = readFileSync(resolve(root, 'kanji-slicer/index.html'), 'utf8');
const listeners = new Map();
const elements = new Map();
const storage = new Map([
    ['kanjislicer_discovered', JSON.stringify(['森林', '森林', 'invalid'])],
    ['katakata-minigames-mute', 'true'],
]);
const document = { hidden: false, activeElement: null };
class Element {
    constructor(id = '', tagName = 'DIV') {
        this.id = id;
        this.tagName = tagName;
        this.style = {};
        this.attributes = {};
        this.children = [];
        this.handlers = new Map();
        this.hidden = id.endsWith('-modal');
        const classes = new Set(this.hidden ? ['hidden'] : []);
        this.classList = { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x) };
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k]; }
    focus() { document.activeElement = this; }
    closest(selector) {
        const tag = this.tagName.toLowerCase();
        return selector.split(',').some(part => part.trim() === tag || (tag === 'a' && part.trim() === 'a[href]')) ? this : null;
    }
    addEventListener(k, fn) { this.handlers.set(k, fn); }
    click() { this.handlers.get('click')?.({ target: this, stopPropagation() {} }); }
    appendChild(child) { this.children.push(child); }
    querySelector(selector) { return this.children.find(el => el.className?.split(' ').includes(selector.slice(1))); }
    querySelectorAll(selector) {
        if (selector === '.recipe-card') return this.children;
        if (this.id === 'pause-modal') return [elements.get('btn-resume'), elements.get('btn-pause-restart')];
        if (this.id === 'gameover-modal') return [elements.get('btn-restart'), new Element('', 'A')];
        return [];
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 640 }; }
    setPointerCapture() {}
}
for (const match of markup.matchAll(/<([\w-]+)\b[^>]*\bid="([^"]+)"/g)) {
    elements.set(match[2], new Element(match[2], match[1].toUpperCase()));
}
const canvas = elements.get('game-canvas');
canvas.parentElement = elements.get('game-canvas-wrapper');
canvas.getContext = () => new Proxy({}, { get: (_, key) => key === 'measureText' ? () => ({ width: 40 }) : () => {} });
Object.assign(document, {
    getElementById: id => elements.get(id),
    querySelector: () => new Element(),
    createElement: tag => new Element('', tag.toUpperCase()),
    addEventListener: (event, fn) => listeners.set(`document:${event}`, fn),
});
document.activeElement = canvas;
const window = {
    devicePixelRatio: 1,
    PointerEvent: function PointerEvent() {},
    addEventListener: (event, fn) => listeners.set(event, fn),
};
const context = vm.createContext({
    document, window, console, Math, Date,
    requestAnimationFrame() {},
    setTimeout() {},
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
});
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
const event = (extra = {}) => ({ pointerId: 1, isPrimary: true, button: 0, clientX: 200, clientY: 80, target: canvas, cancelable: true, preventDefault() {}, ...extra });
const key = (code, extra = {}) => {
    let prevented = false;
    listeners.get('keydown')({ code, target: document.activeElement, preventDefault() { prevented = true; }, ...extra });
    return prevented;
};

assert.equal(run('discoveredKanji.length'), 1, 'stored discoveries must not exceed progress via duplicates');
assert.equal(elements.get('btn-sound').getAttribute('aria-pressed'), 'false', 'stored mute must initialize accessible state');
assert.ok(markup.includes('id="game-instructions"'), 'visible instructions must exist');
assert.equal((markup.match(/class="modal-overlay hidden" hidden/g) || []).length, 2, 'both dialogs must be truly hidden at startup');

context.handleStart(event({ button: 2 }));
context.handleEnd(event({ button: 2 }));
assert.equal(run('bodies.length'), 0, 'right click must not drop a piece');
context.handleStart(event());
context.handleStart(event({ pointerId: 2, isPrimary: false }));
context.handleMove(event({ pointerId: 2, clientX: 350 }));
context.handleEnd(event({ pointerId: 2 }));
assert.equal(run('bodies.length'), 0, 'another pointer must not end the active drag');
assert.equal(run('previewX'), 200, 'another pointer must not move the active drag');
context.handleEnd(event());
context.handleEnd(event());
assert.equal(run('bodies.length'), 1, 'primary pointer releases exactly one piece');
context.handleStart(event()); context.handleEnd(event());
assert.equal(run('bodies.length'), 1, 'rapid input respects the drop cooldown');

context.restartGame();
context.handleStart(event());
key('KeyR');
context.handleEnd(event());
assert.equal(run('bodies.length'), 0, 'restarting mid-drag must not produce a ghost drop');
assert.equal(run('activePointerId'), null);
run('bodiesToSpawn.push({kanji: "林"}); flashAlpha = 1;');
context.restartGame();
assert.equal(run('bodiesToSpawn.length'), 0, 'restart clears queued slice/merge bodies');
assert.equal(run('flashAlpha'), 0);

canvas.focus();
key('Space');
assert.equal(run('isPaused'), true);
assert.equal(elements.get('pause-modal').hidden, false);
assert.equal(elements.get('game-container').inert, true);
assert.equal(elements.get('btn-pause').getAttribute('aria-expanded'), 'true');
assert.equal(document.activeElement.id, 'btn-resume');
assert.equal(key('Space'), false, 'native Space activation of Resume must remain available');
assert.equal(run('isPaused'), true, 'button Space is not consumed by global pause');
key('Tab', { shiftKey: true });
assert.equal(document.activeElement.id, 'btn-pause-restart', 'Shift-Tab is trapped in the active modal');
key('Tab');
assert.equal(document.activeElement.id, 'btn-resume');
elements.get('btn-resume').click();
assert.equal(run('isPaused'), false);
assert.equal(elements.get('pause-modal').hidden, true);
assert.equal(elements.get('game-container').inert, false);
assert.equal(document.activeElement, canvas, 'resume restores focus outside the hidden dialog');
assert.equal(elements.get('btn-pause').getAttribute('aria-expanded'), 'false');
key('KeyP', { repeat: true });
assert.equal(run('isPaused'), false, 'held shortcut does not toggle repeatedly');
key('KeyP'); key('KeyP');
assert.equal(run('isPaused'), false, 'P supports pause and resume');

context.handleStart(event());
listeners.get('blur')();
assert.equal(run('isPaused'), true, 'losing focus pauses play');
assert.equal(run('activePointerId'), null);
context.handleEnd(event());
assert.equal(run('bodies.length'), 0);
key('Escape');
document.hidden = true;
listeners.get('document:visibilitychange')();
assert.equal(run('isPaused'), true, 'switching apps pauses play');
document.hidden = false;
listeners.get('document:visibilitychange')();
assert.equal(run('isPaused'), true, 'returning to the tab requires an explicit resume');
context.restartGame();

// Existing gameplay rules: compounds merge, a swipe decomposes them, and an
// idiom matching the mission scores and replaces the mission.
run(`
    const testBody = (kanji, x = 200, y = 500) => {
        const data = KANJI_DATA[kanji];
        return { kanji, x, y, tier: data.tier, radius: getRadiusForTier(data.tier), mass: 24,
            color: data.color, vx: 0, vy: 0, angle: 0, angularVelocity: 0, mergeCooldown: 0, age: 100, toDelete: false };
    };
    checkMerge(testBody('女'), testBody('子'));
`);
assert.equal(run('bodiesToSpawn[0].kanji'), '好');
assert.equal(run('score'), 20);
run(`const compound = testBody('好'); sliceBody(compound, {x:150,y:500}, {x:250,y:500});`);
assert.equal(run('compound.toDelete'), true);
assert.equal(run('bodiesToSpawn.slice(-2).map(body => body.kanji).join()'), '女,子');
context.restartGame();
run(`bodies = [testBody('好', 200, 500)];`);
context.handleStart(event({ clientX: 150, clientY: 500 }));
run('slashTrail = [];'); // The visual trail expires while the finger is held still.
context.handleMove(event({ clientX: 250, clientY: 500 }));
assert.equal(run('bodies[0].toDelete'), true, 'a held swipe still slices after its visual trail expires');
context.handleEnd(event());
context.restartGame();
run(`currentMission = '火山'; checkMerge(testBody('火'), testBody('山'));`);
assert.equal(run('score'), 120);
assert.notEqual(run('currentMission'), '火山');

context.restartGame();
run(`bodies = [testBody('木', 200, 140)];`);
for (let i = 0; i < 180; i++) context.checkGameOver();
assert.equal(run('isGameOver'), false, 'full board warning allows its grace period');
assert.equal(elements.get('dead-line-alert').hidden, false);
context.checkGameOver();
assert.equal(run('isGameOver'), true);
assert.equal(elements.get('gameover-modal').hidden, false);
assert.equal(document.activeElement.id, 'btn-restart');
context.handleStart(event()); context.handleEnd(event());
assert.equal(run('bodies.length'), 1, 'input after game over cannot drop');
elements.get('btn-restart').click();
assert.equal(run('isGameOver'), false);
assert.equal(run('bodies.length'), 0);
assert.equal(elements.get('dead-line-alert').hidden, true);
assert.equal(elements.get('gameover-modal').hidden, true);
assert.equal(document.activeElement, canvas);

console.log('kanji-slicer lifecycle passed: pointer ownership, restart, dialogs/focus, interruption, merge/slice/mission, game over');
