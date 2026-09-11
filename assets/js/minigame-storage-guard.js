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
        const memory = memoryFor(this);
        // A previous setItem may have fallen back to memory even when native
        // getItem still works (for example, QuotaExceededError on writes only).
        if (memory.has(normalizedKey)) return memory.get(normalizedKey);
        try {
            return originalGetItem.call(this, normalizedKey);
        } catch (_) {
            return null;
        }
    }

    function guardedSetItem(key, value) {
        const normalizedKey = String(key);
        const normalizedValue = String(value);
        const memory = memoryFor(this);
        try {
            originalSetItem.call(this, normalizedKey, normalizedValue);
            // Native storage is authoritative again after a successful write.
            memory.delete(normalizedKey);
        } catch (_) {
            memory.set(normalizedKey, normalizedValue);
        }
    }

    function guardedRemoveItem(key) {
        const normalizedKey = String(key);
        try {
            originalRemoveItem.call(this, normalizedKey);
        } catch (_) {
            // Native removal may be blocked; the in-memory fallback is still
            // cleared below so callers observe removeItem semantics.
        }
        memoryFor(this).delete(normalizedKey);
    }

    function guardedClear() {
        try {
            originalClear.call(this);
        } catch (_) {
            // Native clear may be blocked; always clear the fallback as well.
        }
        memoryFor(this).clear();
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
