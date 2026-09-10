// Kanji Slicer physics was originally authored around a 60 Hz update cadence.
// Keep the existing per-step physics deterministic across 60/90/120/144 Hz displays
// without forcing a risky rewrite of every physics constant at once.
(() => {
    'use strict';

    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const STEP_MS = 1000 / 60;
    const MAX_CATCH_UP_STEPS = 5;
    const EPSILON_MS = 0.01;

    let nextCallbackId = 1;
    let pumpRequestId = null;
    let lastNativeFrameTime = null;
    let accumulatorMs = 0;
    const callbacks = new Map();

    function schedulePump() {
        if (pumpRequestId === null && callbacks.size > 0) {
            pumpRequestId = nativeRequestAnimationFrame(pump);
        }
    }

    function reportAsync(error) {
        window.setTimeout(() => {
            throw error;
        }, 0);
    }

    function pump(timestamp) {
        pumpRequestId = null;

        if (lastNativeFrameTime === null) {
            lastNativeFrameTime = timestamp;
        } else {
            const elapsedMs = Math.max(0, timestamp - lastNativeFrameTime);
            const maxElapsedMs = STEP_MS * MAX_CATCH_UP_STEPS;
            accumulatorMs += Math.min(elapsedMs, maxElapsedMs);
            lastNativeFrameTime = timestamp;
        }

        let stepCount = 0;
        while (
            callbacks.size > 0 &&
            accumulatorMs + EPSILON_MS >= STEP_MS &&
            stepCount < MAX_CATCH_UP_STEPS
        ) {
            const frameCallbacks = Array.from(callbacks.entries());
            callbacks.clear();
            accumulatorMs = Math.max(0, accumulatorMs - STEP_MS);
            stepCount += 1;

            // Use a stable virtual frame timestamp for code that elects to consume it.
            const virtualTimestamp = timestamp - accumulatorMs;
            for (const [, callback] of frameCallbacks) {
                try {
                    callback(virtualTimestamp);
                } catch (error) {
                    reportAsync(error);
                }
            }
        }

        schedulePump();
    }

    window.requestAnimationFrame = (callback) => {
        if (typeof callback !== 'function') {
            throw new TypeError('requestAnimationFrame callback must be a function');
        }

        const callbackId = nextCallbackId++;
        callbacks.set(callbackId, callback);
        schedulePump();
        return callbackId;
    };

    window.cancelAnimationFrame = (callbackId) => {
        callbacks.delete(callbackId);
    };

    Object.defineProperty(window, '__KANJI_SLICER_FIXED_STEP__', {
        value: Object.freeze({
            hz: 60,
            stepMs: STEP_MS,
            maxCatchUpSteps: MAX_CATCH_UP_STEPS
        }),
        configurable: false,
        enumerable: false,
        writable: false
    });
})();
