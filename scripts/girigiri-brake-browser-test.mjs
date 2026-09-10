import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(import.meta.dirname, '..');
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
]);

function serveFile(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  let filePath = join(root, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith('/')) filePath = join(filePath, 'index.html');

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

const server = createServer(serveFile);
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/girigiri-brake/`, { waitUntil: 'networkidle' });

  const initial = await page.evaluate(() => ({
    startActive: document.querySelector('#start-screen')?.classList.contains('active') ?? false,
    hudActive: document.querySelector('#hud')?.classList.contains('active') ?? false,
    resultActive: document.querySelector('#result-screen')?.classList.contains('active') ?? false,
    best: document.querySelector('#best-score-value')?.textContent?.trim() ?? null,
    muteLabel: document.querySelector('#sound-mute-label')?.textContent?.trim() ?? null,
  }));

  if (
    errors.length ||
    !initial.startActive ||
    initial.hudActive ||
    initial.resultActive ||
    initial.best !== '--' ||
    !initial.muteLabel
  ) {
    throw new Error(`initial Girigiri screen is wrong: ${JSON.stringify({ initial, errors })}`);
  }

  await page.click('#start-btn');
  await page.waitForTimeout(100);

  const ready = await page.evaluate(() => ({
    startActive: document.querySelector('#start-screen')?.classList.contains('active') ?? false,
    hudActive: document.querySelector('#hud')?.classList.contains('active') ?? false,
    resultActive: document.querySelector('#result-screen')?.classList.contains('active') ?? false,
    status: document.querySelector('#status-text')?.textContent?.trim() ?? null,
    speed: document.querySelector('#speed-value')?.textContent?.trim() ?? null,
    weather: document.querySelector('#weather-value')?.textContent?.trim() ?? null,
  }));

  if (
    errors.length ||
    ready.startActive ||
    !ready.hudActive ||
    ready.resultActive ||
    ready.status !== 'TAP TO GO!' ||
    ready.speed !== '0' ||
    !ready.weather
  ) {
    throw new Error(`start did not enter READY state: ${JSON.stringify({ ready, errors })}`);
  }

  await page.dispatchEvent('#game-container', 'pointerdown', {
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
  });
  await page.waitForTimeout(250);

  const running = await page.evaluate(() => ({
    status: document.querySelector('#status-text')?.textContent?.trim() ?? null,
    speed: Number(document.querySelector('#speed-value')?.textContent ?? '0'),
    hudActive: document.querySelector('#hud')?.classList.contains('active') ?? false,
  }));

  if (errors.length || !running.hudActive || running.speed <= 0 || running.status !== 'DANGER!!' && running.status !== 'TAP TO GO!') {
    throw new Error(`run input did not start acceleration: ${JSON.stringify({ running, errors })}`);
  }

  await page.dispatchEvent('#game-container', 'pointerdown', {
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
  });
  await page.waitForTimeout(60);

  const braking = await page.evaluate(() => ({
    status: document.querySelector('#status-text')?.textContent?.trim() ?? null,
    speed: Number(document.querySelector('#speed-value')?.textContent ?? '0'),
  }));

  if (errors.length || braking.status !== 'BRAKE!!' || braking.speed < 0) {
    throw new Error(`second input did not enter BRAKING state: ${JSON.stringify({ braking, errors })}`);
  }

  await page.close();

  const storagePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const storageErrors = [];
  storagePage.on('pageerror', (error) => storageErrors.push(error.message));
  await storagePage.addInitScript(() => {
    Object.defineProperties(Storage.prototype, {
      getItem: {
        value() { throw new Error('blocked getItem'); },
        configurable: true,
      },
      setItem: {
        value() { throw new Error('blocked setItem'); },
        configurable: true,
      },
      removeItem: {
        value() { throw new Error('blocked removeItem'); },
        configurable: true,
      },
      clear: {
        value() { throw new Error('blocked clear'); },
        configurable: true,
      },
    });
  });

  await storagePage.goto(`http://127.0.0.1:${port}/girigiri-brake/`, { waitUntil: 'networkidle' });
  await storagePage.click('#start-btn');
  await storagePage.waitForTimeout(100);
  await storagePage.locator('#sound-mute-toggle').check();
  await storagePage.waitForTimeout(50);

  const storageState = await storagePage.evaluate(() => ({
    startActive: document.querySelector('#start-screen')?.classList.contains('active') ?? false,
    hudActive: document.querySelector('#hud')?.classList.contains('active') ?? false,
    status: document.querySelector('#status-text')?.textContent?.trim() ?? null,
    muteChecked: document.querySelector('#sound-mute-toggle')?.checked ?? false,
    muteLabel: document.querySelector('#sound-mute-label')?.textContent?.trim() ?? null,
  }));

  if (
    storageErrors.length ||
    storageState.startActive ||
    !storageState.hudActive ||
    storageState.status !== 'TAP TO GO!' ||
    !storageState.muteChecked ||
    storageState.muteLabel !== '音 OFF 🔇'
  ) {
    throw new Error(`blocked storage should not break Girigiri: ${JSON.stringify({ storageState, storageErrors })}`);
  }

  await storagePage.close();
  console.log('girigiri-brake browser test passed');
} finally {
  if (browser) await browser.close();
  server.close();
}
