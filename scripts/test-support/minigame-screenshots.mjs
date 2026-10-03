import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Optional evidence for human review, not a pixel-baseline assertion. Keep this
// helper free of Playwright imports so its safety contract is testable without a
// browser. No timers, DOM changes, clock control, CSS, or production hooks.
const MAX_CAPTURES = 12;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const FAILURE_RESERVE_BYTES = 4 * 1024 * 1024;
const TOKEN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const disabled = Object.freeze({
    enabled: false,
    track() {},
    async capture() { return false; },
    async captureFailure() { return false; },
});

export function createMinigameScreenshots(game, origin) {
    const directory = process.env.MINIGAME_SCREENSHOT_DIR?.trim();
    if (!directory) return disabled;
    if (!TOKEN.test(game)) throw new Error('Invalid screenshot game slug');
    const allowed = new URL(origin);
    if (allowed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(allowed.hostname)
        || allowed.username || allowed.password || allowed.pathname !== '/' || allowed.search || allowed.hash) {
        throw new Error('Screenshot evidence requires the local test-server origin');
    }
    const output = resolve(directory);
    const pages = new Map();
    const captured = new Set();
    let failureAttempted = false;

    function eligible(page) {
        if (!pages.has(page) || page.isClosed()) return false;
        try {
            const url = new URL(page.url());
            return url.origin === allowed.origin && !url.username && !url.password
                && [ `/${game}/`, `/${game}/index.html` ].includes(url.pathname);
        } catch { return false; }
    }

    async function capture(page, state, failure = false) {
        if (!TOKEN.test(state)) throw new Error('Invalid screenshot state label');
        if (!eligible(page) || (!failure && captured.size >= MAX_CAPTURES)) return false;
        const viewport = page.viewportSize();
        if (!viewport || !Number.isInteger(viewport.width) || !Number.isInteger(viewport.height)
            || viewport.width <= 0 || viewport.height <= 0) return false;
        const dpr = String(pages.get(page)).replace('.', 'p');
        const filename = `${game}__${state}__${viewport.width}x${viewport.height}__dpr-${dpr}.png`;
        if (captured.has(filename)) return false;
        const pixels = await page.screenshot({
            type: 'png', fullPage: false, scale: 'device',
            animations: 'allow', caret: 'initial', timeout: 5000,
        });
        // Do not persist a screenshot if the tracked page navigated while it was
        // being captured. Popups and unrelated pages are never auto-discovered.
        if (!eligible(page)) return false;
        if (pixels.length > MAX_FILE_BYTES) {
            console.warn(`[minigame screenshots] ${game}: skipped oversized ${state} capture`);
            return false;
        }
        await mkdir(output, { recursive: true });
        const existing = (await readdir(output)).filter(name => name.endsWith('.png') && name !== filename);
        const sizes = await Promise.all(existing.map(name => stat(join(output, name))));
        const limit = failure ? MAX_TOTAL_BYTES : MAX_TOTAL_BYTES - FAILURE_RESERVE_BYTES;
        if (sizes.reduce((total, entry) => total + entry.size, 0) + pixels.length > limit) {
            console.warn(`[minigame screenshots] ${game}: PNG evidence size limit reached`);
            return false;
        }
        await writeFile(join(output, filename), pixels);
        captured.add(filename);
        return true;
    }

    return {
        enabled: true,
        // Pass the deviceScaleFactor used for the context; Playwright defaults to
        // 1. Avoid evaluating a potentially failed/hung page just to read DPR.
        track(page, deviceScaleFactor = 1) {
            if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0) throw new Error('Invalid screenshot DPR');
            pages.set(page, deviceScaleFactor);
        },
        capture(page, state) { return capture(page, state); },
        async captureFailure() {
            if (failureAttempted) return false;
            failureAttempted = true;
            try {
                const page = [...pages.keys()].reverse().find(eligible);
                return page ? await capture(page, 'failure', true) : false;
            } catch {
                // Diagnostic evidence must not replace the original test error.
                console.warn(`[minigame screenshots] ${game}: failure screenshot unavailable`);
                return false;
            }
        },
    };
}
