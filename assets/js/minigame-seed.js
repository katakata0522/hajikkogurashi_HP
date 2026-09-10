// Optional deterministic RNG bootstrap for minigames that need reproducible runs.
// If ?seed= is absent, a fresh seed is generated and written into the current URL
// without reloading so the exact run can be reproduced by copying the URL.
(() => {
    'use strict';

    if (window.__CORNER_NEIGHBOR_SEEDED_RANDOM__) return;

    const params = new URLSearchParams(window.location.search);
    const parsed = Number.parseInt(params.get('seed') || '', 10);

    function freshSeed() {
        try {
            if (window.crypto?.getRandomValues) {
                const values = new Uint32Array(1);
                window.crypto.getRandomValues(values);
                return values[0] || 1;
            }
        } catch (_) {
            // Fall through to a timestamp-derived seed.
        }
        return ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) || 1;
    }

    const seed = Number.isFinite(parsed) && parsed > 0 ? (parsed >>> 0) || 1 : freshSeed();

    // Mulberry32: compact deterministic 32-bit PRNG suitable for game generation.
    let state = seed >>> 0;
    function seededRandom() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    Math.random = seededRandom;

    if (!params.has('seed')) {
        try {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('seed', String(seed));
            window.history.replaceState(window.history.state, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
        } catch (_) {
            // URL rewriting is diagnostic convenience only; gameplay must continue.
        }
    }

    document.documentElement.dataset.gameSeed = String(seed);
    Object.defineProperties(window, {
        __CORNER_NEIGHBOR_GAME_SEED__: {
            value: seed,
            configurable: false,
            enumerable: false,
            writable: false,
        },
        __CORNER_NEIGHBOR_SEEDED_RANDOM__: {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false,
        },
    });
})();
