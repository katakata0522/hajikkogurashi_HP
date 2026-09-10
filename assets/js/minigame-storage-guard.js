// Transitional storage compatibility layer for legacy minigames.
// It preserves normal localStorage/sessionStorage behavior, but falls back to
// per-storage in-memory values when a browser/webview blocks the Storage API.
(() => {
    'use strict';

    if (window.__CORNER_NEIGHBOR_STORAGE_GUARD__) return;

    const StorageCtor = window.Storage;
    if (!StorageCtor || !StorageCtor.prototype) return;

    const proto = StorageCtor.prototype;
    const originalGetItem = proto.getItem;
    const originalSetItem = proto.setItem;
    const originalRemoveItem = proto.removeItem;
    const originalClear = proto.clear;
    const memoryByStorage = new WeakMap();

    function memoryFor(storage) {
        let memory = memoryByStorage.get(storage);
        if (!memory) {
            memory = new Map();
            memoryByStorage.set(storage, memory);
        }
        return memory;
    }

    function guardedGetItem(key) {
        const normalizedKey = String(key);
        try {
            return originalGetItem.call(this, normalizedKey);
        } catch (_) {
            const memory = memoryFor(this);
            return memory.has(normalizedKey) ? memory.get(normalizedKey) : null;
        }
    }

    function guardedSetItem(key, value) {
        const normalizedKey = String(key);
        const normalizedValue = String(value);
        try {
            originalSetItem.call(this, normalizedKey, normalizedValue);
        } catch (_) {
            memoryFor(this).set(normalizedKey, normalizedValue);
        }
    }

    function guardedRemoveItem(key) {
        const normalizedKey = String(key);
        try {
            originalRemoveItem.call(this, normalizedKey);
        } catch (_) {
            memoryFor(this).delete(normalizedKey);
        }
    }

    function guardedClear() {
        try {
            originalClear.call(this);
        } catch (_) {
            memoryFor(this).clear();
        }
    }

    try {
        Object.defineProperties(proto, {
            getItem: { value: guardedGetItem, configurable: true, writable: true },
            setItem: { value: guardedSetItem, configurable: true, writable: true },
            removeItem: { value: guardedRemoveItem, configurable: true, writable: true },
            clear: { value: guardedClear, configurable: true, writable: true },
        });

        Object.defineProperty(window, '__CORNER_NEIGHBOR_STORAGE_GUARD__', {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false,
        });
    } catch (_) {
        // If the host locks Storage.prototype, leave native behavior untouched.
    }
})();
