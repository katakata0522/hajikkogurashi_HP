// Browser-free contract checks: all Page objects below are local fakes.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readdir, rm, stat, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMinigameScreenshots } from './test-support/minigame-screenshots.mjs';

const root = await mkdtemp(join(tmpdir(), 'minigame-screenshot-contract-'));
const saved = process.env.MINIGAME_SCREENSHOT_DIR;
const origin = 'http://127.0.0.1:43210';
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
let checks = 0;
function fakePage(overrides = {}) {
    const page = {
        address: `${origin}/sample-game/`, closed: false, calls: [],
        isClosed() { return this.closed; },
        url() { return this.address; },
        viewportSize() { return { width: 390, height: 844 }; },
        async screenshot(options) { this.calls.push(options); return png; },
        ...overrides,
    };
    return page;
}
function enabled(name) {
    process.env.MINIGAME_SCREENSHOT_DIR = join(root, name);
    return createMinigameScreenshots('sample-game', origin);
}
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
async function withoutWarnings(run) {
    const original = console.warn; const warnings = [];
    console.warn = value => warnings.push(value);
    try { return { value: await run(), warnings }; } finally { console.warn = original; }
}
try {
    await check('disabled mode performs no Page calls, validation or filesystem writes', async () => {
        for (const setting of [undefined, '', '   ']) {
            if (setting === undefined) delete process.env.MINIGAME_SCREENSHOT_DIR;
            else process.env.MINIGAME_SCREENSHOT_DIR = setting;
            const helper = createMinigameScreenshots('../invalid', 'not a URL');
            const unavailable = new Proxy({}, { get() { throw Error('unexpected Page call'); } });
            assert.equal(helper.enabled, false); helper.track(unavailable);
            assert.equal(await helper.capture(unavailable, '../invalid'), false);
            assert.equal(await helper.captureFailure(), false);
        }
        assert.deepEqual(await readdir(root), []);
    });
    await check('only loopback origins and safe game labels are accepted', async () => {
        enabled('invalid');
        for (const address of ['https://127.0.0.1:43210', 'http://example.com', 'http://127.0.0.1.evil.test', `${origin}/account`, `${origin}?token=a`, 'http://name:secret@127.0.0.1:43210']) {
            assert.throws(() => createMinigameScreenshots('sample-game', address));
        }
        assert.throws(() => createMinigameScreenshots('../sample-game', origin));
        for (const address of [origin, 'http://localhost:43210', 'http://[::1]:43210']) {
            assert.equal(createMinigameScreenshots('sample-game', address).enabled, true);
        }
    });
    await check('only explicitly tracked expected game routes are captured', async () => {
        const helper = enabled('routes'); const page = fakePage();
        assert.equal(await helper.capture(page, 'launch'), false); // untracked popup
        helper.track(page);
        for (const address of ['about:blank', 'https://example.com/account', `${origin}/sample-game-other/`, `${origin}/minigames.html`, 'http://127.0.0.1:43211/sample-game/', `${origin}/sample-game/account`]) {
            page.address = address; assert.equal(await helper.capture(page, 'launch'), false);
        }
        assert.equal(page.calls.length, 0);
        assert.equal(existsSync(join(root, 'routes')), false);
        page.address = `${origin}/sample-game/index.html`;
        assert.equal(await helper.capture(page, 'launch'), true);
    });
    await check('filenames encode game/state/viewport/configured DPR and deduplicate', async () => {
        const helper = enabled('filenames'); const page = fakePage(); helper.track(page, 2.5);
        assert.equal(await helper.capture(page, 'play-hud'), true);
        assert.equal(await helper.capture(page, 'play-hud'), false);
        assert.deepEqual(await readdir(join(root, 'filenames')), ['sample-game__play-hud__390x844__dpr-2p5.png']);
        assert.deepEqual(page.calls, [{ type: 'png', fullPage: false, scale: 'device', animations: 'allow', caret: 'initial', timeout: 5000 }]);
        assert.throws(() => helper.track(page, NaN));
        await assert.rejects(helper.capture(page, '../escape'));
    });
    await check('closed and unavailable-viewport pages are skipped', async () => {
        const helper = enabled('closed'); const page = fakePage({ closed: true }); helper.track(page);
        assert.equal(await helper.capture(page, 'launch'), false);
        page.closed = false; page.viewportSize = () => null;
        assert.equal(await helper.capture(page, 'launch'), false);
        assert.equal(page.calls.length, 0);
    });
    await check('navigation during capture never persists the buffer', async () => {
        const helper = enabled('navigation');
        const page = fakePage({ async screenshot() { this.address = 'https://example.com/account'; return png; } }); helper.track(page);
        assert.equal(await helper.capture(page, 'launch'), false);
        assert.equal(existsSync(join(root, 'navigation')), false);
    });
    await check('normal screenshot errors remain visible to CI', async () => {
        const helper = enabled('errors'); const page = fakePage({ async screenshot() { throw Error('capture failed'); } }); helper.track(page);
        await assert.rejects(helper.capture(page, 'launch'), /capture failed/);
    });
    await check('failure capture preserves the original error and attempts only once', async () => {
        const helper = enabled('failure-errors'); let attempts = 0;
        const page = fakePage({ async screenshot() { attempts++; throw Error('closed during capture'); } }); helper.track(page);
        const result = await withoutWarnings(() => helper.captureFailure());
        assert.equal(result.value, false); assert.equal(result.warnings.length, 1);
        assert.equal(await helper.captureFailure(), false); assert.equal(attempts, 1);
    });
    await check('failure skips external/closed pages and captures the latest eligible one', async () => {
        const helper = enabled('failure-selection'); const local = fakePage(); helper.track(local, 3);
        helper.track(fakePage({ closed: true })); helper.track(fakePage({ address: 'https://example.com' }));
        assert.equal(await helper.captureFailure(), true);
        assert.deepEqual(await readdir(join(root, 'failure-selection')), ['sample-game__failure__390x844__dpr-3.png']);
        assert.equal(await helper.captureFailure(), false);
    });
    await check('each game permits 12 curated captures plus one failure', async () => {
        const helper = enabled('count'); const page = fakePage(); helper.track(page);
        for (let index = 0; index < 12; index++) assert.equal(await helper.capture(page, `state-${index}`), true);
        assert.equal(await helper.capture(page, 'extra'), false);
        assert.equal(await helper.captureFailure(), true);
        assert.equal((await readdir(join(root, 'count'))).length, 13);
    });
    await check('files larger than 2 MiB are skipped with a warning', async () => {
        const helper = enabled('oversized'); const page = fakePage({ async screenshot() { return Buffer.alloc(2 * 1024 * 1024 + 1); } }); helper.track(page);
        const result = await withoutWarnings(() => helper.capture(page, 'launch'));
        assert.equal(result.value, false); assert.equal(result.warnings.length, 1);
        assert.equal(existsSync(join(root, 'oversized')), false);
    });
    await check('20 MiB normal budget reserves 4 MiB within a shared 24 MiB ceiling', async () => {
        const helper = enabled('budget'); const directory = join(root, 'budget'); await mkdir(directory);
        const prior = join(directory, 'prior.png'); await writeFile(prior, png); await truncate(prior, 20 * 1024 * 1024);
        const page = fakePage(); helper.track(page);
        assert.equal((await withoutWarnings(() => helper.capture(page, 'launch'))).value, false);
        assert.equal(await helper.captureFailure(), true);
        await truncate(prior, 24 * 1024 * 1024);
        const second = enabled('budget'); second.track(page);
        assert.equal((await withoutWarnings(() => second.captureFailure())).value, false);
        assert.equal((await stat(join(directory, 'sample-game__failure__390x844__dpr-1.png'))).size, png.length);
    });
    console.log(`Minigame screenshot contract passed (${checks} browser-free checks).`);
} finally {
    if (saved === undefined) delete process.env.MINIGAME_SCREENSHOT_DIR;
    else process.env.MINIGAME_SCREENSHOT_DIR = saved;
    await rm(root, { recursive: true, force: true });
}
