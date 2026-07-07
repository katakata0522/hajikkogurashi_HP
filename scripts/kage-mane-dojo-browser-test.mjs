import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);

function toFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const withIndex = relativePath.endsWith('/') ? `${relativePath}index.html` : relativePath;
  const filePath = normalize(join(root, withIndex));
  if (!filePath.startsWith(`${root}${sep}`) && filePath !== root) return null;
  return filePath;
}

const server = createServer((req, res) => {
  const filePath = toFilePath(req.url ?? '/');
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

await new Promise((resolveListen) => server.listen(0, host, resolveListen));
const port = server.address().port;
async function launchBrowser() {
  const attempts = [
    () => chromium.launch({ headless: true }),
    () => chromium.launch({ channel: 'chrome', headless: true }),
    () => chromium.launch({ channel: 'msedge', headless: true }),
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const browser = await launchBrowser();

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !text.includes('Failed to load resource')) errors.push(text);
  });

  await page.goto(`http://${host}:${port}/kage-mane-dojo/`, { waitUntil: 'networkidle' });
  await page.click('#startButton');
  await page.waitForSelector('#playScreen.active');
  await page.waitForFunction(() => document.querySelector('#statusText')?.textContent === '同じ順に打つ', null, { timeout: 6000 });

  const state = await page.evaluate(() => ({
    title: document.title,
    lesson: document.querySelector('#lessonLabel')?.textContent,
    length: document.querySelector('#lengthLabel')?.textContent,
    enabledButtons: [...document.querySelectorAll('.dir-button')].filter((button) => !button.disabled).length,
    cardImage: document.querySelector('img[src="/assets/images/kage_mane_dojo_thumbnail.svg"]') !== null,
  }));

  if (state.title !== '影まね道場 | Corner Neighbor' || state.lesson !== '1' || state.length !== '3' || state.enabledButtons !== 4) {
    throw new Error(`unexpected game state: ${JSON.stringify(state)}`);
  }

  await page.goto(`http://${host}:${port}/minigames.html`, { waitUntil: 'networkidle' });
  const card = await page.locator('a[href="/kage-mane-dojo/"]').count();
  const imageStatus = await page.locator('img[src="/assets/images/kage_mane_dojo_thumbnail.svg"]').evaluate((img) => img.complete && img.naturalWidth > 0);
  if (card < 2 || !imageStatus) {
    throw new Error(`minigames card is incomplete: ${JSON.stringify({ card, imageStatus })}`);
  }

  if (errors.length > 0) {
    throw new Error(`browser errors: ${errors.join(' | ')}`);
  }
} finally {
  await browser.close();
  server.close();
}
