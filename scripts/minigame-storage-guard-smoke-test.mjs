import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'assets/js/minigame-storage-guard.js'), 'utf8');

class FakeStorage {
    constructor() {
        this.native = new Map();
        this.failGet = false;
        this.failSet = false;
        this.failRemove = false;
        this.failClear = false;
    }

    getItem(key) {
        if (this.failGet) throw new Error('blocked get');
        const normalized = String(key);
        return this.native.has(normalized) ? this.native.get(normalized) : null;
    }

    setItem(key, value) {
        if (this.failSet) throw new Error('quota/write blocked');
        this.native.set(String(key), String(value));
    }

    removeItem(key) {
        if (this.failRemove) throw new Error('blocked remove');
        this.native.delete(String(key));
    }

    clear() {
        if (this.failClear) throw new Error('blocked clear');
        this.native.clear();
    }
}

const fakeWindow = { Storage: FakeStorage };
vm.runInNewContext(source, { window: fakeWindow, WeakMap, Map, String }, { filename: 'minigame-storage-guard.js' });
assert.equal(fakeWindow.__CORNER_NEIGHBOR_STORAGE_GUARD__, true, 'guard should install on a writable Storage prototype');

const normal = new FakeStorage();
normal.setItem('normal', 123);
assert.equal(normal.getItem('normal'), '123', 'normal native storage behavior should be preserved');
normal.removeItem('normal');
assert.equal(normal.getItem('normal'), null, 'normal removeItem should still work');

const writeOnlyFailure = new FakeStorage();
writeOnlyFailure.failSet = true;
writeOnlyFailure.setItem('quota', 'memory-value');
assert.equal(
    writeOnlyFailure.getItem('quota'),
    'memory-value',
    'memory fallback must be readable when setItem fails but getItem still succeeds with null'
);

writeOnlyFailure.failSet = false;
writeOnlyFailure.setItem('quota', 'native-value');
assert.equal(writeOnlyFailure.getItem('quota'), 'native-value', 'successful native writes should replace stale fallback values');

writeOnlyFailure.failSet = true;
writeOnlyFailure.setItem('remove-me', 'fallback');
writeOnlyFailure.failRemove = true;
writeOnlyFailure.removeItem('remove-me');
assert.equal(writeOnlyFailure.getItem('remove-me'), null, 'removeItem must clear fallback state even when native removal throws');

writeOnlyFailure.setItem('clear-me', 'fallback');
writeOnlyFailure.failClear = true;
writeOnlyFailure.clear();
assert.equal(writeOnlyFailure.getItem('clear-me'), null, 'clear must clear fallback state even when native clear throws');

const fullyBlocked = new FakeStorage();
fullyBlocked.failGet = true;
fullyBlocked.failSet = true;
fullyBlocked.failRemove = true;
fullyBlocked.failClear = true;
fullyBlocked.setItem('blocked', '1');
assert.equal(fullyBlocked.getItem('blocked'), '1', 'fully blocked storage should use in-memory fallback');
fullyBlocked.removeItem('blocked');
assert.equal(fullyBlocked.getItem('blocked'), null, 'fully blocked removeItem should clear fallback');
fullyBlocked.setItem('a', '1');
fullyBlocked.setItem('b', '2');
fullyBlocked.clear();
assert.equal(fullyBlocked.getItem('a'), null, 'fully blocked clear should remove first fallback value');
assert.equal(fullyBlocked.getItem('b'), null, 'fully blocked clear should remove second fallback value');

console.log('minigame storage guard smoke test passed');
